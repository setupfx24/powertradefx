import Script from 'next/script';

// Admin runs in light-orange mode only — matches the trader app's Vantage
// palette. The persisted toggle is ignored; we always set `light` here so a
// stale localStorage value can't drag the user back to the dark theme.
const INIT = `
(function(){
  try {
    var d=document.documentElement;
    d.classList.add('light');
    d.classList.remove('dark');
    d.setAttribute('data-theme','light');
    d.style.backgroundColor='#ffffff';
    d.style.color='#141414';
  } catch(e){}
})();
`;

/** Runs before paint to match persisted theme (zustand persist key: admin-theme). */
export default function ThemeInitScript() {
  return <Script id="admin-theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: INIT }} />;
}
