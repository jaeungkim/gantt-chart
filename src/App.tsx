import Gantt from 'pages/Gantt';

function App() {
  return (
    <Gantt
      tasks={[]}
      ganttHeight="100svh"
      columnWidth="auto"
      // onTasksChange={(updated) => {
      //   console.log('[🛰️ onTasksChange from Router]', updated);
      // }}
    />
  );
}

export default App;
