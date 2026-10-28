import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import TestPreview from '../src/preview/TestPreview';
import '../src/index.css';
createRoot(document.getElementById('root')!).render(<BrowserRouter><TestPreview/></BrowserRouter>);
