# Live Agent POC - Bank ATM Support System

A real-time ticket management system for bank ATM live agent support. This application allows live agents to receive and manage support tickets from ATM machines when customers request assistance.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
cd server
npm install
cd ..
```

### 2. Start the WebSocket Server

Open a terminal and run:

```bash
cd server
npm start
```

This starts the WebSocket server on:
- WebSocket: `wss://localhost:8081`
- HTTPS API: `https://localhost:8081`

> Set `LIVE_AGENT_TLS_CERT` / `LIVE_AGENT_TLS_KEY` to the paths of your mkcert files before running `npm start` so the bridge boots in HTTPS mode.

### 3. Start the Live Agent Dashboard

Open another terminal and run:

```bash
npm run dev
```

The dashboard will be available at `https://localhost:3100`

### 4. Test the System

Open `atm-test-simulator.html` in a browser to simulate ATM ticket creation, or use the curl command:

```bash
curl -X POST https://localhost:8081/api/ticket \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "atmId": "ATM-001",
    "timestamp": "2025-11-21T10:30:00.000Z",
    "status": "pending",
    "customerName": "Test User",
    "issueType": "Card Stuck",
    "description": "Test ticket",
    "priority": "high"
  }'
```

## 📚 Documentation

- **[Integration Guide](INTEGRATION_GUIDE.md)** - Complete guide for integrating with ATM systems
- **[ATM Test Simulator](atm-test-simulator.html)** - Browser-based tool to test ticket creation

## 🎯 Features

- ✅ Real-time ticket reception from ATM machines
- ✅ Ticket status management (Pending → In Progress → Resolved)
- ✅ Priority-based ticket display
- ✅ Detailed ticket view with customer information
- ✅ Filter tickets by status
- ✅ Live connection status indicator
- ✅ Statistics dashboard

## 🏗️ System Architecture

```
ATM Machine              WebSocket Server           Live Agent Dashboard
    │                         │                            │
    │   HTTP POST/WebSocket   │                            │
    │──────────────────────>  │                            │
    │                         │                            │
    │                         │    WebSocket Broadcast     │
    │                         │───────────────────────────>│
    │                         │                            │
    │                         │    Status Updates          │
    │                         │<───────────────────────────│
```

## 🔧 Technical Stack

- **Frontend**: React, TanStack Router, Tailwind CSS
- **Backend**: Node.js WebSocket Server
- **Real-time Communication**: WebSocket + HTTP API
- **Styling**: Tailwind CSS with custom theme (#E1251B)

## 📝 Ticket Data Structure

```typescript
{
  id: string              // Unique identifier
  atmId: string          // ATM machine ID
  timestamp: string      // ISO 8601 timestamp
  status: string         // "pending" | "in-progress" | "resolved"
  customerName?: string  // Optional customer name
  issueType: string      // Brief issue description
  description: string    // Detailed description
  priority: string       // "low" | "medium" | "high"
}
```

## 🌐 Network Setup (Two Computers)

To connect ATM and Live Agent on different computers:

1. Find your Live Agent computer's IP address
2. Update ATM code to use: `https://YOUR_IP:8081/api/ticket`
3. Ensure both computers are on the same network
4. Check firewall settings allow connections on ports 8081 (bridge) and 3100 (dashboard)

---

## Original TanStack Documentation

Welcome to your new TanStack app! 

# Getting Started

To run this application:

```bash
npm install
npm run start
```

# Building For Production

To build this application for production:

```bash
npm run build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
npm run test
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.


## Linting & Formatting


This project uses [eslint](https://eslint.org/) and [prettier](https://prettier.io/) for linting and formatting. Eslint is configured using [tanstack/eslint-config](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
npm run lint
npm run format
npm run check
```


## Shadcn

Add components using the latest version of [Shadcn](https://ui.shadcn.com/).

```bash
pnpx shadcn@latest add button
```



## Routing
This project uses [TanStack Router](https://tanstack.com/router). The initial setup is a file based router. Which means that the routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add another a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you use the `<Outlet />` component.

Here is an example layout that includes a header:

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { Link } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
```

The `<TanStackRouterDevtools />` component is not required so you can remove it if you don't want it in your layout.

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).


## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people",
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json() as Promise<{
      results: {
        name: string;
      }[];
    }>;
  },
  component: () => {
    const data = peopleRoute.useLoaderData();
    return (
      <ul>
        {data.results.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    );
  },
});
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

### React-Query

React-Query is an excellent addition or alternative to route loading and integrating it into you application is a breeze.

First add your dependencies:

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

Next we'll need to create a query client and provider. We recommend putting those in `main.tsx`.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ...

const queryClient = new QueryClient();

// ...

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

You can also add TanStack Query Devtools to the root route (optional).

```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <ReactQueryDevtools buttonPosition="top-right" />
      <TanStackRouterDevtools />
    </>
  ),
});
```

Now you can use `useQuery` to fetch your data.

```tsx
import { useQuery } from "@tanstack/react-query";

import "./App.css";

function App() {
  const { data } = useQuery({
    queryKey: ["people"],
    queryFn: () =>
      fetch("https://swapi.dev/api/people")
        .then((res) => res.json())
        .then((data) => data.results as { name: string }[]),
    initialData: [],
  });

  return (
    <div>
      <ul>
        {data.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
```

You can find out everything you need to know on how to use React-Query in the [React-Query documentation](https://tanstack.com/query/latest/docs/framework/react/overview).

## State Management

Another common requirement for React applications is state management. There are many options for state management in React. TanStack Store provides a great starting point for your project.

First you need to add TanStack Store as a dependency:

```bash
npm install @tanstack/store
```

Now let's create a simple counter in the `src/App.tsx` file as a demonstration.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

function App() {
  const count = useStore(countStore);
  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
    </div>
  );
}

export default App;
```

One of the many nice features of TanStack Store is the ability to derive state from other state. That derived state will update when the base state updates.

Let's check this out by doubling the count using derived state.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store, Derived } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

const doubledStore = new Derived({
  fn: () => countStore.state * 2,
  deps: [countStore],
});
doubledStore.mount();

function App() {
  const count = useStore(countStore);
  const doubledCount = useStore(doubledStore);

  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
      <div>Doubled - {doubledCount}</div>
    </div>
  );
}

export default App;
```

We use the `Derived` class to create a new store that is derived from another store. The `Derived` class has a `mount` method that will start the derived store updating.

Once we've created the derived store we can use it in the `App` component just like we would any other store using the `useStore` hook.

You can find out everything you need to know on how to use TanStack Store in the [TanStack Store documentation](https://tanstack.com/store/latest).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).
