import { useState } from "react";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="app">
      <h1>Webproject</h1>
      <p>React + Supabase startpunt. Begin hier te bouwen.</p>
      <button onClick={() => setCount((c) => c + 1)}>Geteld: {count}</button>
    </main>
  );
}

export default App;