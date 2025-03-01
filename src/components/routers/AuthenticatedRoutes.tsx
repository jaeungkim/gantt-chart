import { Outlet } from 'react-router-dom';

import Layout from 'components/layouts/Layout';

function AuthenticatedRoutes() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default AuthenticatedRoutes;
