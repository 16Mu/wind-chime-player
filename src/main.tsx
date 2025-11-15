import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './styles/settings-new.css';

// 🚀 性能优化：移除StrictMode避免双重渲染和性能问题
// StrictMode在开发模式下会导致组件挂载两次，影响性能诊断
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
