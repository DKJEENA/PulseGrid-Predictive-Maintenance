import { Routes, Route } from "react-router-dom";
import NewFrontend from "./NewFrontend";

function App() {
  return (
    <Routes>
      <Route path="/" element={<NewFrontend />} />
      <Route path="*" element={<NewFrontend />} />
    </Routes>
  );
}

export default App;