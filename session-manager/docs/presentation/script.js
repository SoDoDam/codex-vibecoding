const deck = document.querySelector('#deck');
const slides = [...document.querySelectorAll('[data-slide]')];
const currentSlide = document.querySelector('#currentSlide');
const totalSlides = document.querySelector('#totalSlides');
const previousButton = document.querySelector('#previousButton');
const nextButton = document.querySelector('#nextButton');
let activeIndex = 0;

function formatIndex(index) {
  return String(index + 1).padStart(2, '0');
}

function updateControls(index) {
  activeIndex = index;
  currentSlide.textContent = formatIndex(index);
  totalSlides.textContent = formatIndex(slides.length - 1);
  previousButton.disabled = index === 0;
  nextButton.disabled = index === slides.length - 1;
  history.replaceState(null, '', `#slide-${index + 1}`);
}

function moveTo(index) {
  const nextIndex = Math.max(0, Math.min(slides.length - 1, index));
  slides[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

previousButton.addEventListener('click', () => moveTo(activeIndex - 1));
nextButton.addEventListener('click', () => moveTo(activeIndex + 1));

// 발표 중 자주 쓰는 키로 슬라이드를 이동한다.
document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

  if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(event.key)) {
    event.preventDefault();
    moveTo(activeIndex + 1);
  }
  if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key)) {
    event.preventDefault();
    moveTo(activeIndex - 1);
  }
  if (event.key === 'Home') {
    event.preventDefault();
    moveTo(0);
  }
  if (event.key === 'End') {
    event.preventDefault();
    moveTo(slides.length - 1);
  }
});

// 스크롤로 이동해도 현재 페이지 표시를 동기화한다.
const observer = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  updateControls(slides.indexOf(visible.target));
}, { root: deck, threshold: [0.55, 0.75] });

slides.forEach((slide) => observer.observe(slide));
updateControls(0);
