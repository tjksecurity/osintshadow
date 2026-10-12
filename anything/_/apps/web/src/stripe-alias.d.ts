// Ambient declaration for the existing Vite alias to the real Stripe package.
declare module 'npm:stripe' {
  import Stripe from 'stripe';
  export default Stripe;
}
