import fg from 'fast-glob';
import type { Route } from './+types/not-found';
import { useNavigate } from 'react-router';
import { useCallback, useEffect, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import '@/components/Theme/product.css';

export async function loader({ params }: Route.LoaderArgs) {
  const matches = await fg('src/**/page.{js,jsx,ts,tsx}');
  return {
    path: `/${params['*']}`,
    pages: matches
      .sort((a, b) => a.length - b.length)
      .map((match) => {
        const url = match.replace('src/app', '').replace(/\/page\.(js|jsx|ts|tsx)$/, '') || '/';
        const path = url.replaceAll('[', '').replaceAll(']', '');
        const displayPath = path === '/' ? 'Homepage' : path;
        return { url, path: displayPath };
      }),
  };
}

interface ParentSitemap {
  webPages?: Array<{
    id: string;
    name: string;
    filePath: string;
    cleanRoute?: string;
  }>;
}

export default function CreateDefaultNotFoundPage({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const [siteMap, setSitemap] = useState<ParentSitemap | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'sandbox:sitemap') {
          window.removeEventListener('message', handler);
          setSitemap(event.data.sitemap);
        }
      };

      window.parent.postMessage(
        {
          type: 'sandbox:sitemap',
        },
        '*'
      );
      window.addEventListener('message', handler);

      return () => {
        window.removeEventListener('message', handler);
      };
    }
  }, []);
  const missingPath = loaderData.path.replace(/^\//, '');
  const existingRoutes = loaderData.pages.map((page) => ({
    path: page.path,
    url: page.url,
  }));

  const handleBack = () => {
    navigate('/');
  };

  const handleSearch = (value: string) => {
    if (!siteMap) {
      const path = `/${value}`;
      navigate(path);
    } else {
      navigate(value);
    }
  };

  const handleCreatePage = useCallback(() => {
    window.parent.postMessage(
      {
        type: 'sandbox:web:create',
        path: missingPath,
        view: 'web',
      },
      '*'
    );
  }, [missingPath]);

  return (
    <div className="flex st-product st-workspace w-full min-h-screen flex-col">
      <div className="flex w-full items-center flex-wrap gap-4 p-5 border-b border-[var(--st-line)]">
        <a href="/" aria-label="ShadowTrace home"><BrandLogo className="st-logo" /></a>
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center justify-center w-10 h-10 rounded-md"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Back"
            role="img"
          >
            <path
              d="M8.5957 2.65435L2.25005 9L8.5957 15.3457"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2.25007 9L15.75 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="flex flex-row divide-x divide-[var(--st-line)] rounded-[8px] h-8 w-[300px] border border-[var(--st-line)] bg-[var(--st-inset)] text-[var(--st-muted)]">
          <div className="flex items-center px-[14px] py-[5px]">
            <span>/</span>
          </div>
          <div className="flex items-center min-w-0">
            <p
              className="border-0 bg-transparent px-3 py-2 focus:outline-none truncate max-w-[300px]"
              style={{ minWidth: 0 }}
              title={missingPath}
            >
              {missingPath}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-grow flex-col items-center justify-center pt-[100px] text-center gap-[20px]">
        <h1 className="text-4xl font-medium text-[var(--st-ink)] px-2">
          Uh-oh! This page doesn't exist (yet).
        </h1>

        <p className="pt-4 pb-12 px-2 text-[var(--st-muted)]">
          Looks like "<span className="font-bold">/{missingPath}</span>" isn't part of your project.
          But no worries, you've got options!
        </p>

        <div className="px-[20px] w-full">
          <div className="flex flex-row justify-center items-center w-full max-w-[800px] mx-auto border border-[var(--st-line)] rounded-lg p-[20px] mb-[40px] gap-[20px]">
            <div className="flex flex-col gap-[5px] items-start self-start w-1/2">
              <p className="text-sm text-[var(--st-ink)] text-left">Build it from scratch</p>
              <p className="text-sm text-[var(--st-muted)] text-left">
                Create a new page to live at "<span>/{missingPath}</span>"
              </p>
            </div>
            <div className="flex flex-row items-center justify-end w-1/2">
              <button
                type="button"
                className="bg-[var(--st-accent)] text-[var(--st-bg)] px-[10px] py-[5px] rounded-md"
                onClick={() => handleCreatePage()}
              >
                Create Page
              </button>
            </div>
          </div>
        </div>

        <div className="pb-20 lg:pb-[80px]">
          <p className="flex items-center text-[var(--st-muted)]">
            Check out all your project's routes here ↓
          </p>
        </div>

        {siteMap ? (
          <div className="flex flex-col justify-center items-center w-full px-[50px]">
            <div className="flex flex-col justify-between items-center w-full max-w-[600px] gap-[10px]">
              <p className="text-sm text-gray-300 pb-[10px] self-start p-4">PAGES</p>
              {siteMap.webPages?.map((route) => (
                <button
                  type="button"
                  onClick={() => handleSearch(route.cleanRoute || '')}
                  key={route.id}
                  className="flex flex-row justify-between text-center items-center p-4 rounded-lg bg-[var(--st-panel)] shadow-sm w-full hover:bg-[var(--st-inset)]"
                >
                  <h3 className="font-medium text-[var(--st-ink)]">{route.name}</h3>
                  <p className="text-sm text-[var(--st-muted)]">{route.cleanRoute}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 w-full max-w-[80rem] mx-auto pb-5 px-2">
            {existingRoutes.map((route) => (
              <div
                key={route.path}
                className="flex flex-col flex-grow basis-full sm:basis-[calc(50%-0.375rem)] xl:basis-[calc(33.333%-0.5rem)]"
              >
                <div className="w-full flex-1 flex flex-col items-center ">
                  <div className="relative w-full max-w-[350px] h-48 sm:h-56 lg:h-64 overflow-hidden rounded-[8px] border border-[var(--st-line)] transition-all group-hover:shadow-md">
                    <button
                      type="button"
                      onClick={() => handleSearch(route.url.replace(/^\//, ''))}
                      className="h-full w-full rounded-[8px] bg-[var(--st-inset)] bg-cover"
                    />
                  </div>
                  <p className="pt-3 text-left text-[var(--st-muted)] w-full max-w-[350px]">{route.path}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
