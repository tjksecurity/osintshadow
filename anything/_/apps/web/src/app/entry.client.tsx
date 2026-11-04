import { startTransition, StrictMode, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import { prepareDocumentHydration } from '../__create/prepare-document-hydration';

// Keep React Router's default hydration entry; only accommodate the known
// browser-injected sibling before/during its initial concurrent render.
const finishPreparation = prepareDocumentHydration(document);

function InitialHydration() {
  useEffect(finishPreparation, []);
  return <HydratedRouter />;
}

startTransition(() => {
  try {
    hydrateRoot(
      document,
      <StrictMode>
        <InitialHydration />
      </StrictMode>
    );
  } catch (error) {
    finishPreparation();
    throw error;
  }
});
