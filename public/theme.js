// Runs before the page draws: applies the saved theme (no flash) and
// hides the app if another site loads it inside a frame (clickjacking).
(function () {
  try {
    var t = localStorage.getItem('mlf.theme')
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t)
  } catch (e) {}
  if (window.top !== window.self) {
    document.documentElement.style.display = 'none'
    try { window.top.location = window.self.location } catch (e) {}
  }
})()
