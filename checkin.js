import {
    rateLimiter,
    loadConfig,
    createMosaicBackground,
    validateGitHubUsername,
    showInputError,
    showRadioError,
    setLoading
} from './shared.js';

document.addEventListener('DOMContentLoaded', async () => {
    let config = null;
    let userData = null;

    const usernameInput = document.getElementById('github-username');
    const proceedButton = document.getElementById('proceed-button');
    const errorMessage = document.getElementById('error-message');
    const form = document.getElementById('bootstrapForm');
    const headerContent = document.querySelector('.header-content');
    const logoImage = document.querySelector('.logo-image');
    const heading = document.querySelector('h1');
    const checkinSection = document.getElementById('checkin-section');
    const eventSelection = document.getElementById('event-selection');

    const populateGitTogetherChoices = () => {
        const formGroup = document.querySelector('#event-selection .form-group');
        formGroup.innerHTML = '';
        
        if (config && config.gittogethers) {
            let hasActiveEvents = false;
            
            // Add radio buttons for each event
            if (config.gittogethers.upcoming && config.gittogethers.upcoming.length > 0) {
                const now = new Date();
                config.gittogethers.upcoming.forEach(event => {
                    const endTime = new Date(event.end_time);
                    
                    // Only show events that haven't ended
                    if (now <= endTime) {
                        hasActiveEvents = true;
                        const div = document.createElement('div');
                        div.className = 'radio';
                        div.innerHTML = `
                            <label>
                                <input type="radio" name="selected_event" value="${event.name}" required>
                                ${event.name}
                            </label>
                        `;
                        formGroup.appendChild(div);
                    }
                });
            }

            if (!hasActiveEvents) {
                const content = document.querySelector('.content');
                content.innerHTML = `<div class="thank-you-message">${config.messages.no_events}</div>`;
                document.getElementById('checkin-section').style.display = 'none';
            }
        }
    };

    const showThankYouMessage = () => {
        const content = document.querySelector('.content');
        const userName = document.getElementById('766830585').value;
        const firstName = userName.split(' ')[0];
        const githubUsername = document.getElementById('846479285').value;
        const today = new Date().toISOString().split('T')[0];
        
        content.innerHTML = `
            <div class="thank-you-screen">
                <div class="skyline-container loading">
                    <img src="https://avatars.githubusercontent.com/u/98106734?s=200&v=4" alt="Logo" style="display: none;">
                </div>
                <div class="thank-you-message">
                    ${config.messages.checkin_thank_you.replace('{firstName}', firstName)}
                </div>
                <div class="thank-you-buttons">
                    ${config.thank_you_buttons.map(button => 
                        `<a href="${button.url}" target="_blank" rel="noopener noreferrer" title="${button.text}">${button.text}</a>`
                    ).join('')}
                </div>
            </div>
        `;

        // Only show skyline if user has repos and recent commits
        if (userData?.stats?.publicRepos > 0 && userData?.stats?.hasRecentActivity) {
            const skylineContainer = content.querySelector('.skyline-container');
            const fallbackImage = skylineContainer.querySelector('img');
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
                    skylineContainer.classList.remove('loading');
                    fallbackImage.style.display = 'none';
                    iframe.style.display = 'block';
                });
            };
            
            // Show fallback on error or if loading takes too long
            iframe.onerror = () => {
                skylineContainer.classList.remove('loading');
                fallbackImage.style.display = 'block';
                iframe.remove();
            };

            // Fallback if loading takes too long
            setTimeout(() => {
                if (skylineContainer.classList.contains('loading')) {
                    skylineContainer.classList.remove('loading');
                    fallbackImage.style.display = 'block';
                    iframe.remove();
                }
            }, 10000); // 10 seconds timeout
            
            skylineContainer.appendChild(iframe);
        } else {
            // Show app avatar for users with no repos
            const skylineContainer = content.querySelector('.skyline-container');
            const fallbackImage = skylineContainer.querySelector('img');
            skylineContainer.classList.remove('loading');
            fallbackImage.style.display = 'block';
        }
    };

    const handleSubmit = async (event) => {
        event?.preventDefault();
        
        const username = usernameInput.value.trim();
        errorMessage.textContent = '';
        usernameInput.classList.remove('error');
        
        if (!username) {
            showInputError(usernameInput, 'Please enter your GitHub username');
            return;
        }

        try {
            userData = await validateGitHubUsername(username);
            
            // Fetch additional GitHub stats
            const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?type=public`);
            const repos = await reposResponse.json();
            
            // Get commit activity for the last year
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            
            // Check for commits in the last year using events API
            const eventsResponse = await fetch(`https://api.github.com/users/${username}/events/public`);
            const events = await eventsResponse.json();
            const hasRecentCommits = events.some(event => 
                event.type === 'PushEvent' && 
                new Date(event.created_at) > oneYearAgo
            );
            
            // Store GitHub stats for later use
            userData.stats = {
                publicRepos: userData.public_repos,
                hasRecentActivity: hasRecentCommits
            };

            setLoading(proceedButton, true);

            // Update UI
            logoImage.src = userData.avatar_url;
            const displayName = userData.name || userData.login;
            heading.innerHTML = `Hello<span class="editable-name">${displayName}</span> 👋`;
            headerContent.classList.add('compact');

            // Add name edit links
            const nameEditLinks = document.createElement('div');
            nameEditLinks.className = 'name-edit-links';
            nameEditLinks.innerHTML = `
                <a href="#" class="not-you-link">Not you?</a>
                <a href="#" class="edit-name-link">Edit Name</a>
            `;
            heading.insertAdjacentElement('afterend', nameEditLinks);

            // Add event listeners for name editing
            const editableNameSpan = heading.querySelector('.editable-name');
            const editNameLink = nameEditLinks.querySelector('.edit-name-link');
            const notYouLink = nameEditLinks.querySelector('.not-you-link');
            let originalName = displayName;
            editableNameSpan.setAttribute('data-original-name', originalName);

            const cancelNameEdit = () => {
                editableNameSpan.textContent = originalName;
                editableNameSpan.contentEditable = false;
                editableNameSpan.classList.remove('editing');
                editNameLink.textContent = 'Edit Name';
            };

            const saveNameEdit = () => {
                const newName = editableNameSpan.textContent.trim();
                if (newName) {
                    originalName = newName;
                    editableNameSpan.contentEditable = false;
                    editableNameSpan.classList.remove('editing');
                    editNameLink.textContent = 'Edit Name';
                    document.getElementById('766830585').value = originalName;
                    editableNameSpan.setAttribute('data-original-name', originalName);
                    editableNameSpan.textContent = originalName;
                } else {
                    cancelNameEdit();
                }
            };

            editableNameSpan.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (editNameLink.textContent === 'Save') {
                        saveNameEdit();
                    }
                } else if (e.key === 'Escape') {
                    cancelNameEdit();
                }
            });

            editNameLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (editNameLink.textContent === 'Edit Name') {
                    editableNameSpan.contentEditable = true;
                    editableNameSpan.classList.add('editing');
                    editableNameSpan.focus();
                    const range = document.createRange();
                    range.selectNodeContents(editableNameSpan);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    editNameLink.textContent = 'Save';
                } else {
                    saveNameEdit();
                }
            });

            editableNameSpan.addEventListener('blur', (e) => {
                requestAnimationFrame(() => {
                    const activeElement = document.activeElement;
                    if (editNameLink.textContent === 'Save' && 
                        !activeElement?.closest('.name-edit-links') && 
                        activeElement !== editableNameSpan) {
                        cancelNameEdit();
                    }
                });
            });

            notYouLink.addEventListener('click', (e) => {
                e.preventDefault();
                location.reload();
            });

            // Hide username input and proceed button
            usernameInput.parentElement.style.display = 'none';
            proceedButton.style.display = 'none';

            // Set form values
            document.getElementById('846479285').value = userData.login;
            document.getElementById('766830585').value = displayName;

            // Show check-in section
            checkinSection.style.display = 'block';

            // Handle event selection
            const urlParams = new URLSearchParams(window.location.search);
            const eventParam = urlParams.get('event');
            
            if (eventParam && config.gittogethers.upcoming.some(e => e.name === eventParam)) {
                document.getElementById('2076383007').value = eventParam;
                // Set event name immediately after GitHub validation
                document.getElementById('event-name').textContent = eventParam;
                document.getElementById('event-name').style.display = 'block';
            } else {
                eventSelection.style.display = 'block';
                populateGitTogetherChoices();
                
                // Add event listener for radio buttons
                document.querySelectorAll('input[name="selected_event"]').forEach(radio => {
                    radio.addEventListener('change', () => {
                        document.getElementById('2076383007').value = radio.value;
                        document.getElementById('event-name').textContent = radio.value;
                        document.getElementById('event-name').style.display = 'block';
                    });
                });
            }

            // Add form submit handler
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                // Validate event selection if needed
                if (eventSelection.style.display !== 'none') {
                    const selectedEvent = document.querySelector('input[name="selected_event"]:checked');
                    if (!selectedEvent) {
                        const formGroup = document.querySelector('#event-selection .form-group');
                        showRadioError(formGroup, 'Please select an event');
                        return;
                    }
                }

                // Submit form
                $('#bootstrapForm').ajaxSubmit({
                    url: form.action,
                    type: 'POST',
                    dataType: 'xml',
                    success: function(response) {
                        showThankYouMessage();
                    },
                    error: function() {
                        showThankYouMessage();
                    }
                });
            });

            return true;
        } catch (error) {
            console.error('Error:', error);
            showInputError(usernameInput, 'Invalid GitHub username');
            return false;
        } finally {
            setLoading(proceedButton, false);
        }
    };

    // Add input event listener to clear error state
    usernameInput.addEventListener('input', () => {
        usernameInput.classList.remove('error');
        errorMessage.textContent = '';
    });

    // Event Listeners
    proceedButton.addEventListener('click', handleSubmit);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSubmit(e);
        }
    });

    // Initialize
    config = await loadConfig();
    await createMosaicBackground(config);
}); 