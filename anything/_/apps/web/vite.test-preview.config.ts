import {defineConfig} from 'vite';
import path from 'node:path';
export default defineConfig({root:path.resolve(__dirname,'preview'),esbuild:{jsx:'automatic'},resolve:{alias:{'@':path.resolve(__dirname,'src')}},build:{outDir:path.resolve(__dirname,'test-dist'),emptyOutDir:true}});
