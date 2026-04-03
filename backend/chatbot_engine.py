"""
================================================================================
CHATBOT ENGINE — Offline AI Assistant for Dataset Queries
================================================================================
A rule-based NLP chatbot that answers questions about machine sensor data
WITHOUT requiring any external API. All intelligence comes from:
  1. Keyword-based intent recognition
  2. Statistical analysis on the loaded dataset
  3. Pattern matching against sensor thresholds
  4. Natural language response templates

Supported query types:
  - Machine status queries ("how is CNC-M1 doing?")
  - Statistical queries ("what is the average temperature?")
  - Ranking queries ("which machine has highest failure risk?")
  - Threshold queries ("machines with tool wear above 200")
  - Failure analysis ("what causes failures?")
  - General help ("what can you do?")
================================================================================
"""

import pandas as pd
import numpy as np
import re
from typing import Dict, Any, List, Optional, Tuple


# ===========================================================================
# INTENT PATTERNS — Keywords that map user queries to handler functions
# ===========================================================================
INTENT_PATTERNS = {
    'greeting': [
        r'\b(hello|hi|hey|greetings|howdy|good morning|good evening)\b'
    ],
    'help': [
        r'\b(help|what can you do|capabilities|commands|how to use|guide)\b'
    ],
    'machine_status': [
        r'\b(status|health|condition|how is|state of)\b.*\b(machine|cnc|lathe|mill|press)\b',
        r'\b(machine|cnc|lathe|mill|press)\b.*\b(status|health|condition|doing)\b',
    ],
    'failure_risk': [
        r'\b(failure|risk|danger|critical|at risk|failing|broken|fault)\b',
        r'\b(which|what).*\b(fail|risk|critical|danger)\b',
    ],
    'average_stats': [
        r'\b(average|mean|avg)\b.*\b(temp|temperature|rpm|torque|wear|speed)\b',
        r'\b(temp|temperature|rpm|torque|wear|speed)\b.*\b(average|mean|avg)\b',
    ],
    'max_stats': [
        r'\b(max|maximum|highest|peak|top)\b.*\b(temp|temperature|rpm|torque|wear|speed|health)\b',
        r'\b(temp|temperature|rpm|torque|wear|speed|health)\b.*\b(max|maximum|highest|peak|top)\b',
    ],
    'min_stats': [
        r'\b(min|minimum|lowest|bottom)\b.*\b(temp|temperature|rpm|torque|wear|speed|health)\b',
        r'\b(temp|temperature|rpm|torque|wear|speed|health)\b.*\b(min|minimum|lowest|bottom)\b',
    ],
    'threshold_query': [
        r'\b(above|over|greater|exceed|more than)\b.*\b(\d+)\b',
        r'\b(below|under|less|lower than)\b.*\b(\d+)\b',
    ],
    'count_query': [
        r'\b(how many|count|total|number of)\b.*\b(machine|record|reading|entry|sample|failure)\b',
    ],
    'failure_analysis': [
        r'\b(cause|reason|why|what caused|analysis|analyze|explain)\b.*\b(fail|failure|breakdown)\b',
        r'\b(fail|failure|breakdown)\b.*\b(cause|reason|why|analysis)\b',
    ],
    'summary': [
        r'\b(summary|overview|report|summarize|describe|dataset|data)\b',
    ],
    'distribution': [
        r'\b(distribution|spread|histogram|breakdown|categories)\b',
    ],
    'recommendation': [
        r'\b(recommend|suggestion|advise|what should|maintenance|action|fix)\b',
    ],
    'trend': [
        r'\b(trend|trending|pattern|over time|changing|increasing|decreasing)\b',
    ],
}

# ===========================================================================
# COLUMN NAME MAPPING — Maps keyword variations to actual dataset columns
# ===========================================================================
COLUMN_ALIASES = {
    'temperature': 'Air temperature [K]',
    'temp': 'Air temperature [K]',
    'air_temp': 'Air temperature [K]',
    'air temperature': 'Air temperature [K]',
    'process temp': 'Process temperature [K]',
    'process_temp': 'Process temperature [K]',
    'process temperature': 'Process temperature [K]',
    'rpm': 'Rotational speed [rpm]',
    'speed': 'Rotational speed [rpm]',
    'rotational speed': 'Rotational speed [rpm]',
    'torque': 'Torque [Nm]',
    'wear': 'Tool wear [min]',
    'tool wear': 'Tool wear [min]',
    'tool_wear': 'Tool wear [min]',
    'type': 'Type',
    'failure': 'Machine failure',
    'health': 'health_score',
}


class ChatbotEngine:
    """
    Offline AI chatbot that processes natural language queries 
    against the loaded sensor dataset.
    """
    
    def __init__(self, dataset_path: str = None):
        """Initialize with optional dataset path. Can be updated later."""
        self.df = None
        self.dataset_loaded = False
        self.dataset_info = {}
        
        if dataset_path:
            self.load_dataset(dataset_path)
    
    def load_dataset(self, path: str) -> bool:
        """
        Load a CSV dataset into memory for querying.
        Returns True if successful, False otherwise.
        """
        try:
            self.df = pd.read_csv(path)
            self.dataset_loaded = True
            self.dataset_info = {
                'rows': len(self.df),
                'columns': list(self.df.columns),
                'numeric_cols': list(self.df.select_dtypes(include=[np.number]).columns),
                'path': path,
            }
            return True
        except Exception as e:
            self.dataset_loaded = False
            self.dataset_info = {'error': str(e)}
            return False
    
    def process_query(self, query: str, db_context: Dict = None) -> Dict[str, Any]:
        """
        Main entry point — process a natural language query.
        
        Args:
            query: User's natural language question
            db_context: Optional dict with real-time data from database
        
        Returns:
            {
                'response': str,     # Natural language answer
                'data': dict/list,   # Optional structured data (for tables/charts)
                'type': str,         # Response type: 'text', 'table', 'stats'
            }
        """
        query_lower = query.lower().strip()
        
        # Detect intent
        intent = self._detect_intent(query_lower)
        
        # Route to appropriate handler
        handlers = {
            'greeting': self._handle_greeting,
            'help': self._handle_help,
            'machine_status': self._handle_machine_status,
            'failure_risk': self._handle_failure_risk,
            'average_stats': self._handle_average_stats,
            'max_stats': self._handle_max_stats,
            'min_stats': self._handle_min_stats,
            'threshold_query': self._handle_threshold_query,
            'count_query': self._handle_count_query,
            'failure_analysis': self._handle_failure_analysis,
            'summary': self._handle_summary,
            'distribution': self._handle_distribution,
            'recommendation': self._handle_recommendation,
            'trend': self._handle_trend,
        }
        
        handler = handlers.get(intent, self._handle_unknown)
        return handler(query_lower, db_context)
    
    def _detect_intent(self, query: str) -> str:
        """Match the query against intent patterns to determine what the user wants."""
        for intent, patterns in INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, query, re.IGNORECASE):
                    return intent
        return 'unknown'
    
    def _resolve_column(self, query: str) -> Optional[str]:
        """Find which dataset column the user is referring to."""
        for alias, col_name in COLUMN_ALIASES.items():
            if alias in query:
                # Verify the column exists in the dataset
                if self.df is not None and col_name in self.df.columns:
                    return col_name
        return None
    
    def _check_dataset(self) -> Optional[Dict]:
        """Return an error response if no dataset is loaded."""
        if not self.dataset_loaded or self.df is None:
            return {
                'response': "⚠️ No dataset is currently loaded. Please upload a CSV dataset in the **Data & Models** tab first, then I can answer your questions!",
                'type': 'text',
                'data': None
            }
        return None
    
    # ======================================================================
    # INTENT HANDLERS — Each returns a response dict
    # ======================================================================
    
    def _handle_greeting(self, query: str, ctx: Dict = None) -> Dict:
        status = "📊 Dataset loaded" if self.dataset_loaded else "⚠️ No dataset loaded"
        return {
            'response': f"👋 Hello! I'm your **Predictive Maintenance AI Assistant**. I can analyze your sensor data, identify failure risks, and recommend maintenance actions.\n\n{status} with {self.dataset_info.get('rows', 0):,} records.\n\nTry asking me things like:\n- *\"What is the average temperature?\"*\n- *\"Which machines are at failure risk?\"*\n- *\"Give me a summary of the dataset\"*",
            'type': 'text',
            'data': None
        }
    
    def _handle_help(self, query: str, ctx: Dict = None) -> Dict:
        return {
            'response': """🤖 **Here's what I can do:**

📊 **Data Statistics**
- *"What is the average RPM?"*
- *"Show me the maximum torque"*
- *"How many records have tool wear above 200?"*

🔍 **Failure Analysis**
- *"Which machines are at risk?"*
- *"What causes failures?"*
- *"Show failure distribution"*

📈 **Trends & Summaries**
- *"Give me a dataset summary"*
- *"Show the data distribution"*
- *"What's trending?"*

🔧 **Maintenance**
- *"What maintenance do you recommend?"*
- *"Which machines need attention?"*

I analyze the uploaded dataset directly — no external API needed!""",
            'type': 'text',
            'data': None
        }
    
    def _handle_machine_status(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        # Try to extract machine name from query
        if ctx and 'machines' in ctx:
            machines = ctx['machines']
            statuses = []
            for m in machines:
                if m.get('machine_id', '').lower() in query or len(machines) <= 5:
                    statuses.append(m)
            
            if statuses:
                rows = []
                for s in statuses:
                    health = s.get('health_score', 0)
                    status_label = '🟢 Healthy' if health > 0.7 else ('🟡 Warning' if health > 0.4 else '🔴 Critical')
                    rows.append({
                        'Machine': s.get('machine_id', 'Unknown'),
                        'Health': f"{health:.0%}",
                        'Status': status_label,
                        'RPM': f"{s.get('rpm', 0):.0f}",
                        'Temp': f"{s.get('air_temp', 0):.1f}K",
                    })
                return {
                    'response': f"📊 Here's the current status of **{len(rows)} machine(s)**:",
                    'type': 'table',
                    'data': rows
                }
        
        # Fallback to dataset analysis
        if 'Machine failure' in self.df.columns:
            failure_count = self.df['Machine failure'].sum()
            total = len(self.df)
            return {
                'response': f"Based on the dataset:\n- **{total:,}** total sensor readings\n- **{failure_count:,}** readings associated with machine failures ({failure_count/total:.1%} failure rate)\n- **{total - failure_count:,}** readings show normal operation",
                'type': 'text',
                'data': None
            }
        
        return {'response': "I can see the dataset but couldn't find machine-specific status information. Try asking about specific sensor values.", 'type': 'text', 'data': None}
    
    def _handle_failure_risk(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        if 'Machine failure' not in self.df.columns:
            return {'response': "The dataset doesn't contain a 'Machine failure' column. I need this to analyze failure risks.", 'type': 'text', 'data': None}
        
        failed = self.df[self.df['Machine failure'] == 1]
        total_failures = len(failed)
        
        # Analyze conditions during failures
        response_parts = [f"🚨 **Failure Risk Analysis** ({total_failures:,} failures found in {len(self.df):,} records)\n"]
        
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        risk_factors = []
        for col in numeric_cols:
            if col in ['UDI', 'Machine failure', 'TWF', 'HDF', 'PWF', 'OSF', 'RNQF']:
                continue
            if col in self.df.columns and col in failed.columns:
                mean_normal = self.df[self.df['Machine failure'] == 0][col].mean()
                mean_failure = failed[col].mean()
                if mean_normal != 0:
                    diff_pct = ((mean_failure - mean_normal) / abs(mean_normal)) * 100
                    if abs(diff_pct) > 5:
                        direction = "↑ higher" if diff_pct > 0 else "↓ lower"
                        risk_factors.append({
                            'Sensor': col,
                            'Normal Avg': f"{mean_normal:.2f}",
                            'Failure Avg': f"{mean_failure:.2f}",
                            'Difference': f"{direction} by {abs(diff_pct):.1f}%"
                        })
        
        if risk_factors:
            response_parts.append("**Key differences during failure conditions:**")
            return {
                'response': '\n'.join(response_parts),
                'type': 'table',
                'data': risk_factors
            }
        
        return {'response': '\n'.join(response_parts) + "\nNo significant sensor deviations found during failures.", 'type': 'text', 'data': None}
    
    def _handle_average_stats(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        col = self._resolve_column(query)
        if col:
            avg = self.df[col].mean()
            std = self.df[col].std()
            return {
                'response': f"📊 **{col}** Statistics:\n- **Average:** {avg:.2f}\n- **Std Dev:** {std:.2f}\n- **Min:** {self.df[col].min():.2f}\n- **Max:** {self.df[col].max():.2f}\n- **Median:** {self.df[col].median():.2f}",
                'type': 'stats',
                'data': {
                    'column': col,
                    'mean': round(avg, 4),
                    'std': round(std, 4),
                    'min': round(float(self.df[col].min()), 4),
                    'max': round(float(self.df[col].max()), 4),
                    'median': round(float(self.df[col].median()), 4),
                }
            }
        
        # If no specific column found, show all averages
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        stats = []
        for c in numeric_cols:
            if c not in ['UDI']:
                stats.append({
                    'Column': c,
                    'Average': f"{self.df[c].mean():.2f}",
                    'Std Dev': f"{self.df[c].std():.2f}",
                    'Min': f"{self.df[c].min():.2f}",
                    'Max': f"{self.df[c].max():.2f}",
                })
        
        return {
            'response': "📊 **Average values for all numeric columns:**",
            'type': 'table',
            'data': stats
        }
    
    def _handle_max_stats(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        col = self._resolve_column(query)
        if col:
            max_val = self.df[col].max()
            max_idx = self.df[col].idxmax()
            row = self.df.loc[max_idx]
            return {
                'response': f"📈 **Maximum {col}:** {max_val:.2f}\n\nThis occurred at record #{max_idx + 1}. Other values at this point:\n" + 
                    '\n'.join([f"- {c}: {row[c]}" for c in self.df.columns[:8] if c != col]),
                'type': 'text',
                'data': None
            }
        
        return {'response': "Please specify which sensor you want the maximum for (e.g., temperature, RPM, torque, wear).", 'type': 'text', 'data': None}
    
    def _handle_min_stats(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        col = self._resolve_column(query)
        if col:
            min_val = self.df[col].min()
            return {
                'response': f"📉 **Minimum {col}:** {min_val:.2f}",
                'type': 'text',
                'data': None
            }
        
        return {'response': "Please specify which sensor you want the minimum for (e.g., temperature, RPM, torque, wear).", 'type': 'text', 'data': None}
    
    def _handle_threshold_query(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        # Extract number from query
        numbers = re.findall(r'(\d+\.?\d*)', query)
        threshold = float(numbers[0]) if numbers else None
        
        if threshold is None:
            return {'response': "Please include a numeric threshold value in your query.", 'type': 'text', 'data': None}
        
        col = self._resolve_column(query)
        if not col:
            return {'response': "Please specify which sensor column to filter (e.g., temperature, RPM, torque, wear).", 'type': 'text', 'data': None}
        
        is_above = any(w in query for w in ['above', 'over', 'greater', 'exceed', 'more'])
        
        if is_above:
            filtered = self.df[self.df[col] > threshold]
            direction = "above"
        else:
            filtered = self.df[self.df[col] < threshold]
            direction = "below"
        
        count = len(filtered)
        pct = (count / len(self.df)) * 100
        
        return {
            'response': f"📊 **{count:,} records** ({pct:.1f}%) have **{col}** {direction} **{threshold}**\n\nOut of {len(self.df):,} total records.",
            'type': 'stats',
            'data': {
                'column': col,
                'threshold': threshold,
                'direction': direction,
                'count': count,
                'percentage': round(pct, 2),
            }
        }
    
    def _handle_count_query(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        if 'failure' in query and 'Machine failure' in self.df.columns:
            failures = self.df['Machine failure'].sum()
            return {
                'response': f"📊 **Failure count:** {int(failures):,} failures out of {len(self.df):,} total records ({failures/len(self.df):.1%} failure rate).",
                'type': 'text',
                'data': None
            }
        
        return {
            'response': f"📊 The dataset contains **{len(self.df):,}** records across **{len(self.df.columns)}** columns.",
            'type': 'text',
            'data': None
        }
    
    def _handle_failure_analysis(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        if 'Machine failure' not in self.df.columns:
            return {'response': "No 'Machine failure' column found in the dataset.", 'type': 'text', 'data': None}
        
        # Check for specific failure mode columns
        failure_modes = ['TWF', 'HDF', 'PWF', 'OSF', 'RNQF']
        existing_modes = [f for f in failure_modes if f in self.df.columns]
        
        if existing_modes:
            mode_names = {
                'TWF': 'Tool Wear Failure',
                'HDF': 'Heat Dissipation Failure',
                'PWF': 'Power Failure',
                'OSF': 'Overstrain Failure',
                'RNQF': 'Random Failure'
            }
            
            analysis = []
            for mode in existing_modes:
                count = int(self.df[mode].sum())
                if count > 0:
                    analysis.append({
                        'Failure Mode': mode_names.get(mode, mode),
                        'Code': mode,
                        'Count': count,
                        'Percentage': f"{count/len(self.df)*100:.2f}%"
                    })
            
            total_failures = int(self.df['Machine failure'].sum())
            
            return {
                'response': f"🔍 **Failure Root Cause Analysis**\n\nTotal failures: **{total_failures:,}** out of {len(self.df):,} records\n\n**Breakdown by failure mode:**",
                'type': 'table',
                'data': analysis
            }
        
        return {
            'response': f"The dataset shows **{int(self.df['Machine failure'].sum()):,}** failures but no specific failure mode columns were found.",
            'type': 'text',
            'data': None
        }
    
    def _handle_summary(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        summary_rows = []
        for col in self.df.columns:
            row = {'Column': col, 'Type': str(self.df[col].dtype)}
            if self.df[col].dtype in ['float64', 'int64']:
                row['Mean'] = f"{self.df[col].mean():.2f}"
                row['Std'] = f"{self.df[col].std():.2f}"
                row['Range'] = f"{self.df[col].min():.1f} — {self.df[col].max():.1f}"
            else:
                row['Mean'] = '—'
                row['Std'] = '—'
                row['Range'] = f"{self.df[col].nunique()} unique"
            row['Missing'] = f"{self.df[col].isnull().sum()}"
            summary_rows.append(row)
        
        missing_total = self.df.isnull().sum().sum()
        
        return {
            'response': f"📋 **Dataset Summary**\n- **Records:** {len(self.df):,}\n- **Features:** {len(self.df.columns)}\n- **Missing values:** {missing_total}\n\n**Column details:**",
            'type': 'table',
            'data': summary_rows
        }
    
    def _handle_distribution(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        if 'Type' in self.df.columns:
            type_dist = self.df['Type'].value_counts().to_dict()
            dist_rows = [{'Category': k, 'Count': int(v), 'Percentage': f"{v/len(self.df)*100:.1f}%"} for k, v in type_dist.items()]
            
            return {
                'response': "📊 **Product Type Distribution:**",
                'type': 'table',
                'data': dist_rows
            }
        
        return {'response': "Distribution analysis completed. The dataset contains numeric sensor readings.", 'type': 'text', 'data': None}
    
    def _handle_recommendation(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        recommendations = []
        
        if 'Machine failure' in self.df.columns:
            failure_rate = self.df['Machine failure'].mean()
            if failure_rate > 0.05:
                recommendations.append("🔴 **High failure rate detected** — Implement more frequent inspection schedules")
            elif failure_rate > 0.02:
                recommendations.append("🟡 **Moderate failure rate** — Review maintenance intervals")
            else:
                recommendations.append("🟢 **Low failure rate** — Current maintenance schedule appears adequate")
        
        if 'Tool wear [min]' in self.df.columns:
            high_wear = (self.df['Tool wear [min]'] > 200).sum()
            if high_wear > 0:
                recommendations.append(f"🔧 **{high_wear:,} readings** with critical tool wear (>200 min) — Set up automated tool replacement alerts")
        
        if 'Torque [Nm]' in self.df.columns:
            high_torque = (self.df['Torque [Nm]'] > 60).sum()
            if high_torque > 0:
                recommendations.append(f"⚡ **{high_torque:,} readings** with elevated torque (>60 Nm) — Review cutting parameters and tool condition")
        
        if 'Air temperature [K]' in self.df.columns:
            high_temp = (self.df['Air temperature [K]'] > 304).sum()
            if high_temp > 0:
                recommendations.append(f"🌡️ **{high_temp:,} readings** with high temperature (>304K) — Check cooling system efficiency")
        
        if not recommendations:
            recommendations.append("✅ All sensor parameters within normal ranges. Continue regular maintenance schedule.")
        
        return {
            'response': "🔧 **Maintenance Recommendations based on dataset analysis:**\n\n" + '\n\n'.join(recommendations),
            'type': 'text',
            'data': None
        }
    
    def _handle_trend(self, query: str, ctx: Dict = None) -> Dict:
        err = self._check_dataset()
        if err:
            return err
        
        # Analyze trends in key metrics
        trends = []
        key_cols = {
            'Air temperature [K]': 'Temperature',
            'Rotational speed [rpm]': 'RPM',
            'Torque [Nm]': 'Torque',
            'Tool wear [min]': 'Tool Wear',
        }
        
        for col, label in key_cols.items():
            if col in self.df.columns:
                # Compare first half vs second half of dataset
                mid = len(self.df) // 2
                first_half_avg = self.df[col].iloc[:mid].mean()
                second_half_avg = self.df[col].iloc[mid:].mean()
                
                if first_half_avg != 0:
                    change_pct = ((second_half_avg - first_half_avg) / abs(first_half_avg)) * 100
                    direction = "📈 Increasing" if change_pct > 1 else ("📉 Decreasing" if change_pct < -1 else "➡️ Stable")
                    trends.append({
                        'Sensor': label,
                        'First Half Avg': f"{first_half_avg:.2f}",
                        'Second Half Avg': f"{second_half_avg:.2f}",
                        'Trend': f"{direction} ({change_pct:+.1f}%)"
                    })
        
        if trends:
            return {
                'response': "📈 **Trend Analysis** (comparing first vs second half of dataset):",
                'type': 'table',
                'data': trends
            }
        
        return {'response': "Unable to compute trends — insufficient data points.", 'type': 'text', 'data': None}
    
    def _handle_unknown(self, query: str, ctx: Dict = None) -> Dict:
        """Fallback handler for unrecognized queries."""
        return {
            'response': f"🤔 I'm not sure I understand that query. Here are some things you can ask me:\n\n"
                        f"- **\"What is the average temperature?\"**\n"
                        f"- **\"How many failures are there?\"**\n"
                        f"- **\"Which machines are at risk?\"**\n"
                        f"- **\"Show me a dataset summary\"**\n"
                        f"- **\"What maintenance do you recommend?\"**\n\n"
                        f"Type **\"help\"** for a full list of capabilities.",
            'type': 'text',
            'data': None
        }
