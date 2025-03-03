// Rate limiting implementation
const rateLimiter = {
    lastCall: 0,
    minInterval: 1000, // 1 second between calls
    async throttle(fn) {
        const now = Date.now();
        const timeToWait = Math.max(0, this.lastCall + this.minInterval - now);
        
        if (timeToWait > 0) {
            await new Promise(resolve => setTimeout(resolve, timeToWait));
        }
        
        try {
            const result = await fn();
            this.lastCall = Date.now(); // Update after successful execution
            return result;
        } catch (error) {
            // Don't update lastCall on error to allow immediate retry
            throw error;
        }
    }
};

// Load config
const loadConfig = async () => {
    try {
        const response = await fetch('config.yml');
        const yamlText = await response.text();
        return jsyaml.load(yamlText);
    } catch (error) {
        console.error('Error loading config:', error);
        return null;
    }
};

// Create mosaic background
const createMosaicBackground = async (config) => {
    try {
        const mosaicContainer = document.createElement('div');
        mosaicContainer.className = 'background-mosaic';
        document.body.insertBefore(mosaicContainer, document.body.firstChild);

        // Check localStorage first
        const cachedImages = localStorage.getItem('mosaicImages');
        let images;
        
        if (cachedImages) {
            images = JSON.parse(cachedImages);
        } else {
            images = config.background_images;
            localStorage.setItem('mosaicImages', JSON.stringify(images));
        }

        // Shuffle and select only 9 images
        const shuffledImages = [...images]
            .sort(() => Math.random() - 0.5)
            .slice(0, 9);

        // Load all images first
        const imageLoadPromises = shuffledImages.map(src => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            });
        });

        // Wait for all images to load
        const loadedImages = await Promise.all(imageLoadPromises);

        // Create 9 image elements in a grid
        loadedImages.forEach((img, i) => {
            const newImg = document.createElement('img');
            newImg.src = img.src;
            newImg.className = 'mosaic-image';
            newImg.alt = '';
            mosaicContainer.appendChild(newImg);
        });

        // Show the mosaic after everything is ready
        requestAnimationFrame(() => {
            mosaicContainer.classList.add('initialized');
        });

    } catch (error) {
        console.error('Error loading background images:', error);
    }
};

// GitHub username validation
const validateGitHubUsername = async (username) => {
    // Basic validation before API call
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
        throw new Error('Invalid username format');
    }
    
    return rateLimiter.throttle(async () => {
        const response = await fetch(`https://api.github.com/users/${username}`);
        if (response.status === 404) {
            throw new Error('Username not found');
        } else if (!response.ok) {
            throw new Error('GitHub API error');
        }
        return response.json();
    });
};

// Error handling functions
const showInputError = (input, message) => {
    const originalPlaceholder = input.placeholder;
    
    input.classList.add('error');
    input.value = '';
    input.placeholder = message;
    
    // Reset the input state after animation
    setTimeout(() => {
        input.classList.remove('error');
        input.placeholder = originalPlaceholder;
    }, 2000);
};

const showRadioError = (container, message) => {
    let errorDiv = container.querySelector('.radio-error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'radio-error-message';
        container.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.classList.add('show');

    if (window.innerWidth <= 768) {
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

// Loading state management
const setLoading = (button, isLoading) => {
    if (isLoading) {
        button.textContent = 'Pushing to production..';
        button.style.opacity = '0.7';
        button.disabled = true;
    } else {
        button.textContent = 'Proceed';
        button.style.opacity = '1';
        button.disabled = false;
    }
};

// Add this new function
const createSkylineDisplay = (container, userData, githubUsername) => {
    const today = new Date().toISOString().split('T')[0];
    const fallbackImage = container.querySelector('img');
    
    // Only show skyline if user has repos and recent commits
    if (userData?.stats?.publicRepos > 0 && userData?.stats?.hasRecentActivity) {
        const iframe = document.createElement('iframe');
        
        iframe.src = `https://skyline3d.in/${githubUsername}/embed?endDate=${today}&enableZoom=true`;
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.frameBorder = '0';
        iframe.title = 'GitHub Skyline';
        iframe.style.display = 'none';
        
        // Show skyline only when loaded
        iframe.onload = () => {
            requestAnimationFrame(() => {
                container.classList.remove('loading');
                fallbackImage.style.display = 'none';
                iframe.style.display = 'block';
            });
        };
        
        // Show fallback on error or if loading takes too long
        iframe.onerror = () => {
            container.classList.remove('loading');
            fallbackImage.style.display = 'block';
            iframe.remove();
        };

        // Fallback if loading takes too long
        setTimeout(() => {
            if (container.classList.contains('loading')) {
                container.classList.remove('loading');
                fallbackImage.style.display = 'block';
                iframe.remove();
            }
        }, 10000); // 10 seconds timeout
        
        container.appendChild(iframe);
    } else {
        // Show app avatar for users with no repos
        container.classList.remove('loading');
        fallbackImage.style.display = 'block';
    }
};

// Export functions for use in other files
export {
    rateLimiter,
    loadConfig,
    createMosaicBackground,
    validateGitHubUsername,
    showInputError,
    showRadioError,
    setLoading,
    createSkylineDisplay
}; 