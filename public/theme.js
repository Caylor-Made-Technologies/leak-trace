// Runs before the page draws: applies the saved theme (no flash) and
// hides the app if another site loads it inside a frame (clickjacking).
(function () {
  try {
    var t = localStorage.getItem('mlf.theme')
    // Dark by default; 'system' follows the phone; light or dark when chosen in Settings.
    if (t !== 'system') document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark')
  } catch (e) { document.documentElement.setAttribute('data-theme', 'dark') }
  if (window.top !== window.self) {
    document.documentElement.style.display = 'none'
    try { window.top.location = window.self.location } catch (e) {}
  }
})()
