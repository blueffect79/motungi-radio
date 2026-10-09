/// <reference types="vite/client" />
import {mountApp} from './App';
import './styles/app.css';
void mountApp(document.querySelector<HTMLElement>('#app')!);
