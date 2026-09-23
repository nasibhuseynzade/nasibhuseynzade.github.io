// Typewriter effect for About section
function typeWriter() {
    const aboutItems = document.querySelectorAll('.about-info-item');
    const aboutContent = document.getElementById('aboutContent');
    
    aboutContent.classList.add('animate-text');
    
    aboutItems.forEach((item, itemIndex) => {
        const valueSpan = item.querySelector('.value');
        const text = valueSpan.textContent;
        
        valueSpan.innerHTML = '';
        const chars = text.split('');
        
        chars.forEach((char, charIndex) => {
            setTimeout(() => {
                const span = document.createElement('span');
                span.textContent = char;
                span.className = 'typewriter-text';
                valueSpan.appendChild(span);
            }, (itemIndex * 60) + (charIndex * 70));
        });
    });
}

// Intersection Observer to trigger animation when section is visible
function initializeTypewriter() {
    const aboutSection = document.getElementById('aboutContent');

    // Without this the throw would take the rest of the init with it, carousels
    // included, on any page that has no about section.
    if (!aboutSection) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                typeWriter();
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, {
        threshold: 0.3 // Trigger when 30% of the section is visible
    });
    
    observer.observe(aboutSection);
}

// Carousel: slides by one card, then moves that card to the other end of the
// track so the list cycles forever.
function setupCarousel(carousel) {
    const viewport = carousel.querySelector('.carousel-viewport');
    const track = carousel.querySelector('.carousel-track');
    const buttons = carousel.querySelectorAll('.carousel-nav');

    if (!viewport || !track || track.children.length < 2) {
        buttons.forEach(function(button) { button.hidden = true; });
        return;
    }

    let inFlight = null;

    // With a shadow on the left, the first card in the markup would start out
    // half hidden. Rotating once up front puts the last card in that slot so
    // the opening pair is the first two cards as written.
    if (readLead() < 1) {
        track.insertBefore(track.children[track.children.length - 1], track.children[0]);
    }

    const originals = [].slice.call(track.children);

    // Two readable cards plus a shadow on each side fills four slots, so a
    // shorter list would leave an edge empty. Whole copies of the set are
    // appended until the row is covered; they stop being added the moment the
    // markup itself has enough cards.
    function padTrack() {
        const step = stepSize();
        if (!step) return;

        const needed = Math.ceil(viewport.clientWidth / step) + 2;
        while (track.children.length < needed) {
            originals.forEach(function(card) {
                const clone = card.cloneNode(true);
                clone.setAttribute('aria-hidden', 'true');
                clone.querySelectorAll('a, button').forEach(function(node) {
                    node.tabIndex = -1;
                });
                track.appendChild(clone);
            });
        }
    }

    function readLead() {
        return parseFloat(getComputedStyle(carousel).getPropertyValue('--carousel-lead')) || 1;
    }

    // How far the track sits to the left at rest, so the leading card shows
    // only the fraction that --carousel-lead asks for.
    function restOffset() {
        return track.children[0].getBoundingClientRect().width * (1 - readLead());
    }

    function stepSize() {
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        return track.children[0].getBoundingClientRect().width + gap;
    }

    function place(offset) {
        track.style.transform = 'translateX(' + -offset + 'px)';
    }

    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // Snap the slide to its end state: move the card that slid out to the far
    // end of the track and reset the offset, so order matches what is on screen.
    function settle() {
        if (!inFlight) return;

        clearTimeout(inFlight.timer);
        track.removeEventListener('transitionend', inFlight.onEnd);
        const slidCard = inFlight.card;
        inFlight = null;

        track.style.transition = 'none';
        if (slidCard) track.appendChild(slidCard);
        place(restOffset());
        void track.offsetWidth; // flush the reset before transitions resume
        track.style.transition = '';
    }

    function slideTo(offset, cardToRecycle) {
        // Card hover transitions bubble up here too, so only react to the track.
        const onEnd = function(event) {
            if (event && event.target !== track) return;
            settle();
        };

        inFlight = {
            card: cardToRecycle,
            onEnd: onEnd,
            timer: setTimeout(settle, 700) // safety net if transitionend is missed
        };

        track.addEventListener('transitionend', onEnd);
        place(offset);
    }

    function goNext() {
        // An impatient second click settles the running slide instead of being
        // dropped, so every click moves the carousel by exactly one card.
        settle();

        const first = track.children[0];

        if (prefersReducedMotion()) {
            track.appendChild(first);
            place(restOffset());
            return;
        }

        slideTo(restOffset() + stepSize(), first);
    }

    function goPrev() {
        settle();

        // Bring the trailing card round to the front, then jump the offset by
        // one step so nothing appears to move, and animate back to rest.
        track.insertBefore(track.children[track.children.length - 1], track.children[0]);

        const rest = restOffset();

        if (prefersReducedMotion()) {
            place(rest);
            return;
        }

        track.style.transition = 'none';
        place(rest + stepSize());
        void track.offsetWidth;
        track.style.transition = '';

        slideTo(rest, null);
    }

    const prevButton = carousel.querySelector('.carousel-prev');
    const nextButton = carousel.querySelector('.carousel-next');
    if (prevButton) prevButton.addEventListener('click', goPrev);
    if (nextButton) nextButton.addEventListener('click', goNext);

    // Card widths are percentage based, so the resting offset moves with the
    // viewport and has to be recomputed when it changes.
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            settle();
            padTrack();
            track.style.transition = 'none';
            place(restOffset());
            void track.offsetWidth;
            track.style.transition = '';
        }, 150);
    });

    padTrack();
    track.style.transition = 'none';
    place(restOffset());
    void track.offsetWidth;
    track.style.transition = '';
}

function initCarousels() {
    document.querySelectorAll('.carousel').forEach(setupCarousel);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeTypewriter();
    initCarousels();
    
    // Add smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('nav a:not(.logo)[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const offsetTop = targetSection.offsetTop - 80; // Account for fixed nav
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Add active navigation highlighting
    const sections = document.querySelectorAll('section[id]');
    const navItems = document.querySelectorAll('nav a:not(.logo)[href^="#"]');
    
    function highlightNavigation() {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.pageYOffset >= sectionTop - 100) {
                current = section.getAttribute('id');
            }
        });
        
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${current}`) {
                item.classList.add('active');
            }
        });
    }
    
    // Set initial state and update on scroll
    highlightNavigation();
    window.addEventListener('scroll', highlightNavigation, { passive: true });
});