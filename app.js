// js/app.js - Main application logic (optional, for global functionalities not covered by auth.js or specific pages)

// This file can be used for any global JavaScript logic that applies across multiple pages.
// For example, fetching a list of all users or managing general UI interactions.

import { db } from './firebase_config.js'; // Assuming you need db in app.js as well

document.addEventListener('DOMContentLoaded', () => {
    // Example: Fetch and display a list of all users (excluding the current one)
    // This assumes you have an HTML element with id="members-container"
    const membersContainer = document.getElementById('members-container');

    if (membersContainer) {
        db.collection('users').onSnapshot(snapshot => {
            membersContainer.innerHTML = ''; // Clear existing members
            snapshot.forEach(doc => {
                const user = doc.data();
                const userElement = document.createElement('div');
                userElement.classList.add('member-item');
                userElement.innerHTML = `<a href="profile.html?uid=${doc.id}">${user.displayName || user.email}</a>`;
                membersContainer.appendChild(userElement);
            });
        }, (error) => {
            console.error("Error loading members:", error);
            membersContainer.innerHTML = '<p style="color: red;">Error loading members.</p>';
        });
    }

    // You can add more global JavaScript logic here.
    // For instance, a common function for pop-up messages, or general event listeners.
});