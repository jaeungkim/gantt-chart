import Gantt from 'pages/Gantt';

function App() {
  return (
    <Gantt
      tasks={[]}
      ganttHeight={500}
      columnWidth={1000}
      // onTasksChange={(updated) => {
      //   console.log('[🛰️ onTasksChange from Router]', updated);
      // }}
    />
  );
}

export default App;
