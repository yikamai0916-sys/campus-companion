// Apply the saved palette before styles are painted, including on the login screen.
try {
  document.documentElement.dataset.theme = localStorage.getItem('campus-theme') === 'dark' ? 'dark' : 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}
