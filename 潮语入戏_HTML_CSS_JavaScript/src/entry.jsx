import '../work/local-storage.js';
import React from '../site/node_modules/react/index.js';
import { createRoot } from '../site/node_modules/react-dom/client.js';
import Explorer from '../site/app/explorer.tsx';
createRoot(document.getElementById('root')).render(<Explorer />);
