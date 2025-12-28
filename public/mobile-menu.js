// Mobile menu toggle functionality with 3-bar hamburger animation
document.addEventListener('DOMContentLoaded', () => {
    // Create mobile menu toggle button with 3 bars
    const mobileToggle = document.createElement('button');
    mobileToggle.className = 'mobile-menu-toggle';
    mobileToggle.setAttribute('aria-label', 'Toggle menu');
    mobileToggle.innerHTML = `
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
    `;
    
    // Insert after navbar
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        navbar.insertBefore(mobileToggle, navbar.firstChild);
    } else {
        document.body.insertBefore(mobileToggle, document.body.firstChild);
    }

    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.container');
    
    // Toggle sidebar with smooth animation
    mobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = sidebar.classList.toggle('open');
        mobileToggle.classList.toggle('active');
        
        // Add overlay when menu is open
        if (isOpen) {
            createOverlay();
        } else {
            removeOverlay();
        }
    });

    // Create overlay for mobile menu
    function createOverlay() {
        let overlay = document.getElementById('mobile-menu-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mobile-menu-overlay';
            overlay.className = 'mobile-menu-overlay';
            document.body.appendChild(overlay);
            
            overlay.addEventListener('click', () => {
                closeMenu();
            });
        }
        overlay.style.display = 'block';
        setTimeout(() => overlay.classList.add('active'), 10);
    }

    function removeOverlay() {
        const overlay = document.getElementById('mobile-menu-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    }

    function closeMenu() {
        sidebar.classList.remove('open');
        mobileToggle.classList.remove('active');
        removeOverlay();
    }

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
                closeMenu();
            }
        }
    });

    // Close sidebar when clicking on a link
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMenu();
            }
        });
    });

    // Close menu on window resize if it becomes desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeMenu();
        }
    });
});

