// Mobile menu toggle functionality
document.addEventListener('DOMContentLoaded', () => {
    // Create mobile menu toggle button
    const mobileToggle = document.createElement('button');
    mobileToggle.className = 'mobile-menu-toggle';
    mobileToggle.innerHTML = '☰';
    mobileToggle.setAttribute('aria-label', 'Toggle menu');
    document.body.insertBefore(mobileToggle, document.body.firstChild);

    const sidebar = document.querySelector('.sidebar');
    
    // Toggle sidebar
    mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        mobileToggle.innerHTML = sidebar.classList.contains('open') ? '✕' : '☰';
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
                sidebar.classList.remove('open');
                mobileToggle.innerHTML = '☰';
            }
        }
    });

    // Close sidebar when clicking on a link
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                mobileToggle.innerHTML = '☰';
            }
        });
    });
});

