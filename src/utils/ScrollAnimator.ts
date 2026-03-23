export class ScrollAnimator {
  #observer: IntersectionObserver;

  constructor() {
    this.#observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
  }

  observe(): void {
    document.querySelectorAll('.stagger-in').forEach(el => {
      this.#observer.observe(el);
    });
  }
}
