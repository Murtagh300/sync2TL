/* A dApp opened in another instance asks to forward sign requests there.
   A file of its own (not inline) so the Content-Security-Policy can forbid inline scripts. */
try {
    if ((location.hash || '').startsWith('#/sign?')) {
        const forward = localStorage.getItem('connex-forward')
        if (forward) {
            location.href = new URL(location.hash, forward).href
        }
    }
} catch (err) {
    console.warn('failed to handle forward:', err)
}
