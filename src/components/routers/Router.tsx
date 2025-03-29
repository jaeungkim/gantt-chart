import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router-dom';

import { ROUTE_PATH } from 'constants/routePath';
import Gantt from 'pages/Gantt';
import NotFound from 'pages/NotFound';

import AuthenticatedRoutes from './AuthenticatedRoutes';
import UnauthenticatedRoutes from './UnauthenticatedRoutes';

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route element={<AuthenticatedRoutes />}>
        {/* 대시보드 */}
        <Route
          path={`${ROUTE_PATH.gantt}/*`}
          element={
            <Gantt
              tasks={[]}
              // onTasksChange={(updated) => {
              //   console.log('[🛰️ onTasksChange from Router]', updated);
              // }}
            />
          }
        />
      </Route>
      <Route element={<UnauthenticatedRoutes />}>
        <Route path={ROUTE_PATH.NOT_FOUND} element={<NotFound />} />
      </Route>
    </>,
  ),
  {
    future: {
      v7_relativeSplatPath: true,
    },
  },
);

function Router() {
  return <RouterProvider router={router} />;
}

export default Router;
