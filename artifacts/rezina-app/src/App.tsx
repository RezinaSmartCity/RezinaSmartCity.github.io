import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ToasterProvider } from '@/components/ui/toast-provider';
import Home from '@/pages/Home';
import Admin from '@/pages/Admin';
import NotFound from '@/pages/not-found';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ToasterProvider>
      <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}>
        <Router />
      </WouterRouter>
    </ToasterProvider>
  );
}

export default App;
