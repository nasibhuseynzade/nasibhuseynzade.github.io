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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeTypewriter();
    
    // Add smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('nav a[href^="#"]');
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
    const navItems = document.querySelectorAll('nav a[href^="#"]');
    
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
    
    // Listen for scroll events
    window.addEventListener('scroll', highlightNavigation);
});