import Gantt from "pages/Gantt";
import { sourceTasks } from "../db";

function App() {
  return <Gantt tasks={sourceTasks} height="100svh" width="100%" />;
}

export default App;
