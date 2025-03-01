# React Gantt Chart

![React Gantt Chart](https://raw.githubusercontent.com/jaeungkim/react-gantt-chart/main/public/readmeImg.png)

**React Gantt Chart** is a lightweight, high-performance Gantt chart component for React applications, built with **Vite, Zustand, and React Query** for fast rendering and state management. It is designed to be highly customizable and easy to integrate into modern React projects.

🎯 Motivation

I originally wanted to use Microsoft Project's Gantt Chart for personal project management, but it required subscription 😔. Thus, I decided to build my own Gantt chart, referencing various open-source projects and examples, including MS Project, DHTMLX, Frappe Gantt Chart, and etc.

Since there aren’t many open-source Gantt chart solutions available, I hope this project will be useful for others as well. I am very open to feedback, feature requests, and contributions to make this Gantt chart as robust and versatile as possible.

Currently, this project is built specifically for React due to my development background, but in the future, I may explore making it available for other frameworks as well. Since this is my first open-source project, I look forward to learning and improving it with the community!

## 🚀 Features
- 📊 **Lightweight & Fast** – Optimized with Vite for lightning-fast performance.
- 🏗 **Modern State Management** – Uses Zustand for efficient and minimal state handling.
- 🔄 **Drag & Drop Support** – Easily move and resize tasks.
- 🎨 **Customizable Themes** – Style your Gantt chart with Tailwind CSS or custom styles.
- 🔗 **Dependencies Between Tasks** – Visualize relationships between tasks.
- 📆 **Zoom & Pan** – Navigate large project timelines with ease.
- 🔧 **API & Data Fetching** – Optional integration with React Query for backend connectivity.
- 🌍 **Internationalization (i18n)** – Multi-language support for global usage.

---

## 📦 Installation

Install via npm:

```sh
npm install react-gantt-chart
```

Or with yarn:

```sh
yarn add react-gantt-chart
```

---

## 🛠 Usage

Basic example to integrate **React Gantt Chart** into your project:

```tsx
import React from "react";
import GanttChart from "react-gantt-chart";

const tasks = [
  { id: 1, name: "Task 1", start: "2024-03-01", end: "2024-03-05", progress: 50 },
  { id: 2, name: "Task 2", start: "2024-03-06", end: "2024-03-10", progress: 30 }
];

export default function App() {
  return (
    <div style={{ width: "100%", height: "500px" }}>
      <GanttChart tasks={tasks} />
    </div>
  );
}
```

---

## 🎨 Customization

### **Theming with TailwindCSS**

You can apply custom styles using TailwindCSS or standard CSS:

```css
.gantt-container {
  background-color: #f8f9fa;
}
```

### **Custom Task Styling**

You can pass a `taskRenderer` function to customize task appearance:

```tsx
<GanttChart
  tasks={tasks}
  taskRenderer={(task) => (
    <div style={{ background: task.progress > 50 ? "#4caf50" : "#ff9800" }}>
      {task.name}
    </div>
  )}
/>
```

---

## 📡 API & Props

| Prop         | Type       | Description                          |
|-------------|-----------|--------------------------------------|
| `tasks`     | `Task[]`   | Array of tasks for the Gantt chart  |
| `onTaskClick` | `function` | Callback when a task is clicked    |
| `zoomLevel` | `number`   | Adjust the zoom level (1-5)        |
| `taskRenderer` | `function` | Custom render function for tasks |

### **Task Object Structure**

```ts
interface Task {
  id: number;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies?: number[];
}
```

---

## ⚡ Performance Optimizations
- **Virtualized Rendering** – Uses `react-window` for handling large datasets efficiently.
- **Zustand for State Management** – Avoids unnecessary re-renders.
- **Code Splitting** – Load components lazily with `React.lazy()` and `Suspense`.

---

## 🛠 Contributing
We welcome contributions! To get started:

1. **Fork the repo** and clone it locally:
   ```sh
   git clone https://github.com/your-username/react-gantt-chart.git
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Run the dev server:**
   ```sh
   npm run dev
   ```
4. **Submit a pull request!** 🎉

---

## ❓ FAQ
### **1. How do I handle large datasets?**
Use the `react-window` library for virtualization.

### **2. Can I add task dependencies?**
Yes! Provide an array of `dependencies` for each task.

### **3. Does this support dark mode?**
Yes, you can customize it with CSS or Tailwind.

---

## 📜 License
This project is licensed under the **MIT License** – feel free to use and modify it as needed.

---

## 🌟 Support & Community
- **GitHub Issues** – Report bugs or request features [here](https://github.com/your-username/react-gantt-chart/issues).
- **Discussions** – Join the community and share ideas.

If you find this project useful, please ⭐ star the repo and contribute!

---

**🚀 Build better project timelines with React Gantt Chart!**

