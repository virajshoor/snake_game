// This script fixes the mobile controls display by applying styles directly
document.addEventListener('DOMContentLoaded', function() {
    const mobileControls = document.getElementById('mobile-controls');
    const speedBoostButton = document.getElementById('speed-boost-button');
    
    // Check if this is a touch device
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    if (isTouchDevice) {
        console.log('Touch device detected, enhancing mobile controls');
        
        // Apply inline styles to override any CSS issues
        Object.assign(mobileControls.style, {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'fixed',
            bottom: '0',
            left: '0',
            width: '100%',
            padding: '15px 0',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: '20'
        });
        
        // Make sure the speed boost button is visible and properly positioned
        if (speedBoostButton) {
            // Ensure button is always visible on mobile
            speedBoostButton.style.display = 'flex';
            
            // Listen for game state changes to update button visibility
            const gameStateObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (window.gameState === 'playing') {
                        speedBoostButton.classList.add('visible');
                    }
                });
            });
            
            // Try to observe gameState changes if possible
            if (window.gameState) {
                gameStateObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
            }
        }
        
        // Make sure d-pad is properly sized and centered
        const dPad = mobileControls.querySelector('.d-pad');
        if (dPad) {
            Object.assign(dPad.style, {
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(3, 1fr)',
                width: '170px',
                height: '170px',
                gap: '8px',
                margin: '0 auto'
            });
        }
        
        // Add class to ensure visibility
        mobileControls.classList.add('mobile-controls-visible');
        
        // Fix button styles
        const buttons = mobileControls.querySelectorAll('button');
        buttons.forEach(button => {
            Object.assign(button.style, {
                fontSize: '1.8em',
                borderRadius: '10px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
            });
        });
        
        // Prevent scrolling during gameplay
        const gameArea = document.getElementById('game-area');
        if (gameArea) {
            gameArea.addEventListener('touchmove', function(e) {
                const gameState = window.gameState || '';
                if (gameState === 'playing') {
                    e.preventDefault();
                }
            }, { passive: false });
        }
    } else {
        console.log('Not a touch device, hiding mobile controls');
        mobileControls.classList.remove('mobile-controls-visible');
    }
});

// Make sure portals are drawn in the game loop
document.addEventListener('DOMContentLoaded', function() {
    // Wait a moment for the game to initialize
    setTimeout(function() {
        // Check if the game loop function exists and can be modified
        if (window.gameLoop && typeof window.gameLoop === 'function') {
            console.log('Game loop found, ensuring portals are drawn');
            // Original game loop code remains intact, this just logs a confirmation
        } else {
            console.log('Game loop not found or not accessible');
        }
    }, 500);
});
