// Debug script for diagnosing blank screen issues
(function() {
    // Create a visible debug container on the page
    function createDebugContainer() {
        const debugDiv = document.createElement('div');
        debugDiv.id = 'debug-container';
        debugDiv.style.position = 'fixed';
        debugDiv.style.bottom = '10px';
        debugDiv.style.left = '10px';
        debugDiv.style.right = '10px';
        debugDiv.style.background = 'rgba(0, 0, 0, 0.8)';
        debugDiv.style.color = '#00ff00';
        debugDiv.style.padding = '10px';
        debugDiv.style.borderRadius = '5px';
        debugDiv.style.fontFamily = 'monospace';
        debugDiv.style.fontSize = '12px';
        debugDiv.style.maxHeight = '200px';
        debugDiv.style.overflowY = 'auto';
        debugDiv.style.zIndex = '9999';
        document.body.appendChild(debugDiv);
        return debugDiv;
    }

    // Log a message to the debug container
    function logDebug(message, isError = false) {
        const container = document.getElementById('debug-container') || createDebugContainer();
        const logItem = document.createElement('div');
        logItem.textContent = `[${new Date().toISOString().substr(11, 8)}] ${message}`;
        
        if (isError) {
            logItem.style.color = '#ff5555';
        }
        
        container.appendChild(logItem);
        container.scrollTop = container.scrollHeight;
        
        // Also log to console
        if (isError) {
            console.error(message);
        } else {
            console.log(message);
        }
    }

    // Capture and log global errors
    window.onerror = function(message, source, lineno, colno, error) {
        logDebug(`ERROR: ${message} at ${source}:${lineno}:${colno}`, true);
        return false;
    };

    // Capture promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        logDebug(`UNHANDLED PROMISE REJECTION: ${event.reason}`, true);
    });

    // Check if key elements exist
    window.addEventListener('DOMContentLoaded', function() {
        logDebug('DOM Content Loaded');
        
        // Check for key elements
        const appContent = document.getElementById('app-content');
        logDebug(`app-content element exists: ${!!appContent}`);
        
        const welcomeScreen = document.getElementById('welcome-screen');
        logDebug(`welcome-screen element exists: ${!!welcomeScreen}`);
        
        // Check if app container is being properly displayed
        if (appContent) {
            logDebug(`app-content display style: ${window.getComputedStyle(appContent).display}`);
            logDebug(`app-content opacity: ${window.getComputedStyle(appContent).opacity}`);
            logDebug(`app-content classes: ${appContent.className}`);
        }
        
        // Check if loading overlay still exists
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            logDebug(`loadingOverlay display style: ${window.getComputedStyle(loadingOverlay).display}`);
            logDebug(`loadingOverlay opacity: ${window.getComputedStyle(loadingOverlay).opacity}`);
        } else {
            logDebug('loadingOverlay element does not exist');
        }
    });

    // Check for Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
        logDebug('Telegram WebApp is available');
    } else {
        logDebug('Telegram WebApp is NOT available', true);
    }

    // Check for required libraries and global objects
    setTimeout(function() {
        logDebug('Checking global objects...');
        
        if (window.casinoApp) {
            logDebug('casinoApp is available');
        } else {
            logDebug('casinoApp is NOT available', true);
        }
        
        if (window.GreenLightApp) {
            logDebug('GreenLightApp is available');
            logDebug(`GreenLightApp.loading: ${JSON.stringify(window.GreenLightApp.loading)}`);
        } else {
            logDebug('GreenLightApp is NOT available', true);
        }
    }, 1000);

    logDebug('Debug script initialized');
})();