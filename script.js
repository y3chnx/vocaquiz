const app = {
    words: [],
    activeWords: [],
    currentFileName: '',
    currentMode: 'welcome',
    currentIndex: 0,
    testQuestions: [],
    testSettings: { mc: true, sa: true, fitb: true, tf: true },
    gameScore: 0,
    gameCorrectCount: 0,
    failedWords: new Set(),
    totalGameWords: 0,
    gameResults: [],
    currentWordAttempted: false,

    init() {
        document.addEventListener('change', (e) => {
            if (e.target.id === 'file-input') this.handleFileUpload(e);
        });
    },

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.words = JSON.parse(e.target.result);
                this.currentFileName = file.name.replace('.json', '');
                this.activeWords = [...this.words];
                this.switchMode('overview');
            } catch (err) { alert("Invalid JSON format."); }
        };
        reader.readAsText(file);
    },

    async loadFromUrl() {
        const urlInput = document.getElementById('link-input');
        const url = urlInput.value.trim();
        const container = document.getElementById('app-container');
        
        if (!url) return alert("Please enter a link.");

        // Extract ID from Google Drive link
        const fileIdMatch = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
        if (!fileIdMatch) return alert("Invalid Google Drive sharing link format.");

        const fileId = fileIdMatch[1];
        const directUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl)}`;

        // Loading indicator
        const originalContent = container.innerHTML;
        container.innerHTML = `<div class="fade-in"><h2>Loading data...</h2><p>Please wait a moment.</p></div>`;

        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("Unable to fetch file. Check sharing permissions.");
            
            const data = await response.json();
            
            let contents = data.contents;

            // 1. If Data URL format (Base64 decoding)
            if (contents.startsWith('data:')) {
                const base64Part = contents.split(',')[1];
                if (base64Part) {
                    const binaryString = atob(base64Part);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    contents = new TextDecoder().decode(bytes);
                }
            }

            // 2. Check if Google Drive returned a warning page (HTML)
            if (contents.trim().startsWith('<')) {
                throw new Error("Received HTML response instead of JSON. Check if file is too large or sharing is set to 'Public'.");
            }

            const parsedData = JSON.parse(contents);
            if (!Array.isArray(parsedData)) throw new Error("JSON format is not an array ([]).");

            this.words = parsedData;
            
            this.currentFileName = "Google Drive Set";
            this.activeWords = [...this.words];
            this.switchMode('overview');
        } catch (err) {
            console.error(err);
            container.innerHTML = originalContent; // Restore original content on error
            alert("Error occurred: " + err.message);
        }
    },

    switchMode(mode) {
        this.currentMode = mode;
        this.currentIndex = 0;
        if (mode === 'flashcards' || mode === 'learn') {
            this.activeWords = [...this.words]; // Reset study list on mode switch
        }
        this.render();
    },

    render() {
        const container = document.getElementById('app-container');
        if (this.words.length === 0 && this.currentMode !== 'welcome' && this.currentMode !== 'game') {
            container.innerHTML = `<p>단어를 먼저 업로드해주세요.</p>`;
            return;
        }
        
        switch(this.currentMode) {
            case 'overview':
                this.renderOverview(container);
                break;
            case 'flashcards':
                this.renderFlashcards(container);
                break;
            case 'learn':
                this.renderLearn(container);
                break;
            case 'test':
                this.renderTestSettings(container);
                break;
            case 'game':
                this.renderGameMenu(container);
                break;
            default:
                break;
        }
    },

    renderOverview(container) {
        container.innerHTML = `
            <div class="fade-in">
                <h1 class="set-title">📚 ${this.currentFileName}</h1>
                <p style="color: #666; margin-bottom: 30px;">Total ${this.words.length} words ready. Select a learning mode.</p>
                
                <div class="overview-actions">
                    <button class="main-btn" onclick="app.switchMode('flashcards')">Flashcards</button>
                    <button class="main-btn" onclick="app.switchMode('learn')">Learn</button>
                    <button class="main-btn" onclick="app.switchMode('test')">Test</button>
                    <button class="main-btn" onclick="app.switchMode('game')" style="background-color: #9b59b6;">Game</button>
                </div>

                <div style="text-align: left; margin-top: 40px;">
                    <h3>Word List</h3>
                    <table class="word-table">
                        <thead>
                            <tr>
                                <th>Vocab</th>
                                <th>Definition</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.words.map(w => `
                                <tr>
                                    <td><strong>${w.vocab}</strong></td>
                                    <td>${w.definition}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderGameMenu(container) {
        container.innerHTML = `
            <div class="fade-in">
                <h2>🎮 Select Game Mode</h2>
                <p>Review your words while having fun!</p>
                <div class="overview-actions">
                    <button class="main-btn" style="background-color: #e67e22; font-size: 1.2rem; padding: 20px 40px;" onclick="app.startSpaceGame()">
                        🚀 Spaceship Game (Destroy Satellites)
                    </button>
                </div>
                <button class="main-btn" style="background-color: #95a5a6;" onclick="app.switchMode('overview')">Back</button>
            </div>
        `;
    },

    startSpaceGame() {
        this.currentMode = 'space-game';
        this.activeWords = [...this.words].sort(() => 0.5 - Math.random());
        this.currentIndex = 0;
        this.gameScore = 0;
        this.gameCorrectCount = 0;
        this.failedWords.clear();
        this.gameResults = [];
        this.currentWordAttempted = false;
        this.totalGameWords = this.activeWords.length;
        this.renderSpaceGame();
    },

    renderSpaceGame() {
        const container = document.getElementById('app-container');
        if (this.currentIndex >= this.activeWords.length) {
            const accuracy = Math.round((this.gameCorrectCount / this.totalGameWords) * 100);
            
            const resultsHtml = this.gameResults.map(r => `
                <tr class="${r.isCorrect ? 'row-correct' : 'row-incorrect'}">
                    <td><strong>${r.vocab}</strong></td>
                    <td>${r.userAnswer}</td>
                    <td>${r.correctAnswer}</td>
                    <td>${r.isCorrect ? '✅' : '❌'}</td>
                </tr>
            `).join('');

            container.innerHTML = `
                <div class="fade-in">
                    <h2>🚀 Mission Accomplished!</h2>
                    <h1 style="font-size: 3rem; color: #f1c40f;">Accuracy: ${accuracy}%</h1>
                    <p style="margin-bottom: 20px;">Final Score: ${this.gameScore}</p>
                    
                    <div class="test-results" style="margin-top: 30px; text-align: left;">
                        <h3>Detailed Results Report</h3>
                        <table class="word-table">
                            <thead>
                                <tr><th>Word</th><th>My Choice</th><th>Correct Answer</th><th>Result</th></tr>
                            </thead>
                            <tbody>
                                ${resultsHtml}
                            </tbody>
                        </table>
                    </div>

                    <button class="main-btn" onclick="app.startSpaceGame()">Play Again</button>
                    <button class="main-btn" style="background-color: #95a5a6;" onclick="app.switchMode('overview')">Back to Word Set</button>
                </div>`;
            return;
        }

        const currentWord = this.activeWords[this.currentIndex];
        
        // Extract 4 distractors
        let distractors = this.words
            .filter(w => w.vocab !== currentWord.vocab)
            .sort(() => 0.5 - Math.random())
            .slice(0, 4);
        
        const allChoices = [...distractors, currentWord].sort(() => 0.5 - Math.random());
        const choices = [];
        
        // Slot system for overlapping prevention (divide 0~100% into 5 sections)
        const slots = [5, 23, 41, 59, 77];
        // Shuffle slots
        slots.sort(() => Math.random() - 0.5);

        allChoices.forEach((choice, index) => {
            choices.push({
                text: choice.definition,
                isCorrect: choice.vocab === currentWord.vocab,
                vocab: choice.vocab,
                id: index,
                left: slots[index] + (Math.random() * 5) // Slight randomness within slot
            });
        });

        container.innerHTML = `
            <div class="game-area">
                <div class="game-header">
                    <div class="game-score">Score: ${this.gameScore}</div>
                    <div class="game-target">Target Word: <span>${currentWord.vocab}</span></div>
                    <div class="game-progress">${this.currentIndex + 1} / ${this.activeWords.length}</div>
                </div>
                
                <div class="space-stage">
                    <div class="spaceship"></div>
                    ${choices.map(c => `
                        <div class="satellite" 
                             style="left: ${c.left}%; animation-duration: ${Math.random() * 2 + 7}s;" 
                             onclick="app.shootSatellite(this, ${c.isCorrect})"
                             onanimationend="app.handleMiss(${c.isCorrect})">
                            <div class="satellite-content">${c.text}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    handleMiss(isCorrect) {
        // Handle when the correct satellite hits the bottom
        if (isCorrect && this.currentMode === 'space-game') {
            const currentWord = this.activeWords[this.currentIndex];
            this.failedWords.add(currentWord.vocab);
            
            this.gameResults.push({
                vocab: currentWord.vocab,
                userAnswer: "(Missed)",
                correctAnswer: currentWord.definition,
                isCorrect: false
            });

            this.gameScore = Math.max(0, this.gameScore - 30);
            this.currentWordAttempted = false;
            this.currentIndex++;
            this.renderSpaceGame();
        }
    },

    shootSatellite(el, isCorrect) {
        // Ignore if already attempted or destroyed
        if (this.currentWordAttempted || el.classList.contains('destroyed')) return;
        
        // Set attempt status (prevent double clicks)
        this.currentWordAttempted = true;
        
        // Disable all clicks
        const allSatellites = document.querySelectorAll('.satellite');
        allSatellites.forEach(s => s.style.pointerEvents = 'none');

        const currentWord = this.activeWords[this.currentIndex];

        if (isCorrect) {
            el.classList.add('hit-correct');
            this.gameCorrectCount++;
            this.gameScore += 100;

            this.gameResults.push({
                vocab: currentWord.vocab,
                userAnswer: el.innerText.trim(),
                correctAnswer: currentWord.definition,
                isCorrect: true
            });
        } else {
            el.classList.add('hit-wrong');
            this.gameScore = Math.max(0, this.gameScore - 50);
            this.failedWords.add(currentWord.vocab);

            this.gameResults.push({
                vocab: currentWord.vocab,
                userAnswer: el.innerText.trim(),
                correctAnswer: currentWord.definition,
                isCorrect: false
            });

            // Shake effect
            const stage = document.querySelector('.space-stage');
            stage.classList.add('shake');
            setTimeout(() => stage.classList.remove('shake'), 500);
        }

        // Update score display
        const scoreEl = document.querySelector('.game-score');
        if (scoreEl) scoreEl.innerText = `Score: ${this.gameScore}`;

        // Move to next after 1 second
        setTimeout(() => {
            this.currentWordAttempted = false;
            this.currentIndex++;
            this.renderSpaceGame();
        }, 1000);
    },

    renderTestSettings(container) {
        container.innerHTML = `
            <div class="fade-in">
                <h2>📝 Test Settings</h2>
                <p>Select question types to include.</p>
                <div class="test-config">
                    <label><input type="checkbox" id="type-mc" checked> Multiple Choice</label><br>
                    <label><input type="checkbox" id="type-sa" checked> Short Answer</label><br>
                    <label><input type="checkbox" id="type-fitb" checked> Fill in the Blanks</label><br>
                    <label><input type="checkbox" id="type-tf" checked> True or False</label>
                </div>
                <button class="main-btn" onclick="app.startTest()">Start Test</button>
                <button class="main-btn" style="background-color: #95a5a6;" onclick="app.switchMode('overview')">Cancel</button>
            </div>
        `;
    },

    startTest() {
        const settings = {
            mc: document.getElementById('type-mc').checked,
            sa: document.getElementById('type-sa').checked,
            fitb: document.getElementById('type-fitb').checked,
            tf: document.getElementById('type-tf').checked
        };

        const enabledTypes = Object.keys(settings).filter(k => settings[k]);
        if (enabledTypes.length === 0) return alert("Select at least one type.");

        this.testQuestions = this.words.map(word => {
            // Randomly select a valid type
            let possibleTypes = [...enabledTypes];
            if (!word.sentence) possibleTypes = possibleTypes.filter(t => t !== 'fitb');
            
            const type = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
            let questionData = { ...word, type, userAnswer: '' };

            if (type === 'mc' || type === 'tf') {
                const isTrue = Math.random() > 0.5;
                // Ensure wrongDef is different from the correct definition
                let wrongDef = this.words.find(w => w.vocab !== word.vocab)?.definition;
                if (!wrongDef || wrongDef === word.definition) {
                    // Fallback if no distinct wrong definition is found
                    wrongDef = "Other meaning"; 
                }
                questionData.displayDef = isTrue ? word.definition : wrongDef;
                questionData.correctAnswer = isTrue ? 'true' : 'false';
            }
            
            if (type === 'mc') {
                let distractors = this.words.filter(w => w.vocab !== word.vocab).sort(() => 0.5 - Math.random()).slice(0, 3);
                questionData.choices = [...distractors.map(d => d.definition), word.definition].sort(() => 0.5 - Math.random());
                questionData.correctAnswer = word.definition;
            } else if (type === 'sa') {
                questionData.correctAnswer = word.definition;
            } else if (type === 'fitb') {
                questionData.correctAnswer = word.vocab;
            }

            return questionData;
        });

        this.currentIndex = 0;
        this.renderTestInterface();
    },

    renderTestInterface() {
        const container = document.getElementById('app-container');
        const q = this.testQuestions[this.currentIndex];
        
        let questionHtml = '';
        if (q.type === 'mc') {
            questionHtml = `
                <p>Select the correct meaning:</p>
                <h3>${q.vocab}</h3>
                <div class="quiz-options">
                    ${q.choices.map(c => `<button class="option-btn ${q.userAnswer === c ? 'selected' : ''}" onclick="app.saveAnswer(this.innerText.trim())">${c}</button>`).join('')}
                </div>`;
        } else if (q.type === 'sa') {
            questionHtml = `
                <p>Enter the meaning of the word:</p>
                <h3>${q.vocab}</h3>
                <input type="text" class="test-input" value="${q.userAnswer}" oninput="app.saveAnswer(this.value)" placeholder="Type answer...">`;
        } else if (q.type === 'fitb') {
            const displayedSentence = q.sentence.replace(new RegExp(q.vocab, 'gi'), '_____');
            questionHtml = `
                <p>Enter the word that fits the context:</p>
                <h3>${displayedSentence}</h3>
                <input type="text" class="test-input" value="${q.userAnswer}" oninput="app.saveAnswer(this.value)" placeholder="Type word...">`;
        } else if (q.type === 'tf') {
            questionHtml = `
                <p>Does the word match the definition?</p>
                <h3>${q.vocab} = ${q.displayDef}</h3>
                <div class="overview-actions">
                    <button class="main-btn ${q.userAnswer === 'true' ? 'selected' : ''}" onclick="app.saveAnswer('true')">O (True)</button>
                    <button class="main-btn ${q.userAnswer === 'false' ? 'selected' : ''}" style="background-color: #e74c3c;" onclick="app.saveAnswer('false')">X (False)</button>
                </div>`;
        }

        container.innerHTML = `
            <div class="mode-header">
                <h2>Test Mode (${this.currentIndex + 1} / ${this.testQuestions.length})</h2>
            </div>
            <div class="test-container fade-in">
                ${questionHtml}
            </div>
            <div class="control-btns">
                <button class="main-btn" style="background-color: #95a5a6;" onclick="app.moveQuestion(-1)" ${this.currentIndex === 0 ? 'disabled' : ''}>Prev</button>
                ${this.currentIndex === this.testQuestions.length - 1 
                    ? `<button class="main-btn" style="background-color: #2ecc71;" onclick="app.submitTest()">Submit</button>` 
                    : `<button class="main-btn" onclick="app.moveQuestion(1)">Next</button>`}
            </div>
        `;
    },

    saveAnswer(val) {
        this.testQuestions[this.currentIndex].userAnswer = val;
        if (this.testQuestions[this.currentIndex].type === 'mc' || this.testQuestions[this.currentIndex].type === 'tf') {
            this.renderTestInterface();
        }
    },

    moveQuestion(step) {
        this.currentIndex += step;
        this.renderTestInterface();
    },

    submitTest() {
        if (!confirm("Submit the test?")) return;
        const container = document.getElementById('app-container');
        let score = 0;
        
        console.log("submitTest called. Total questions:", this.testQuestions.length); // Debug log

        if (this.testQuestions.length === 0) {
            console.log("No questions to submit."); // Debug log
            container.innerHTML = `
                <div class="fade-in">
                    <h2>📊 Results</h2>
                    <p>No questions to solve.</p>
                    <button class="main-btn" onclick="app.switchMode('overview')">Back</button>
                </div>
            `;
            return;
        }

        const resultsHtml = this.testQuestions.map(q => {
            const userAnswer = String(q.userAnswer || "").trim().toLowerCase();
            const correctAnswer = String(q.correctAnswer || "").trim().toLowerCase();
            const isCorrect = userAnswer === correctAnswer;
            
            if (isCorrect) score++;
            
            console.log(`Question: ${q.vocab}, User Answer: "${userAnswer}", Correct Answer: "${correctAnswer}", Is Correct: ${isCorrect}`); // Debug log

            return `
                <tr class="${isCorrect ? 'row-correct' : 'row-incorrect'}">
                    <td>${q.vocab}</td>
                    <td>${String(q.userAnswer).trim() || '(Empty)'}</td>
                    <td>${q.correctAnswer}</td>
                    <td>${isCorrect ? '✅' : '❌'}</td>
                </tr>`;
        }).join('');

        console.log("Final score:", score, "out of", this.testQuestions.length); // Debug log

        container.innerHTML = `
            <div class="fade-in">
                <h2>📊 Results</h2>
                <h1 style="font-size: 3rem; color: var(--primary-color);">${Math.round((score / this.testQuestions.length) * 100)} pts</h1>
                <p>You got ${score} out of ${this.testQuestions.length} correct.</p>
                <table class="word-table">
                    <thead><tr><th>Word</th><th>My Answer</th><th>Correct Answer</th><th>Result</th></tr></thead>
                    <tbody>${resultsHtml}</tbody>
                </table>
                <button class="main-btn" onclick="app.switchMode('overview')">Back</button>
            </div>
        `;
    },

    renderFlashcards(container) {
        if (this.activeWords.length === 0) {
            container.innerHTML = `
                <div class="completion-message">
                    <h2>🎉 Congratulations!</h2>
                    <p>You've mastered all the words.</p>
                    <button class="main-btn" onclick="app.switchMode('flashcards')">Study Again</button>
                    <button class="main-btn" style="background-color: #95a5a6;" onclick="app.switchMode('overview')">Back to Overview</button>
                </div>
            `;
            return;
        }

        const item = this.activeWords[this.currentIndex];
        container.innerHTML = `
            <div class="mode-header">
                <h2>Flashcard Learning</h2>
                <div class="progress-bar">Words remaining: ${this.activeWords.length} / Total: ${this.words.length}</div>
            </div>
            <div class="card-container fade-in">
                <div class="flashcard" id="main-card" onclick="this.classList.toggle('is-flipped')">
                    <div class="card-inner">
                        <div class="card-face front">${item.vocab}</div>
                        <div class="card-face back">${item.definition}</div>
                    </div>
                </div>
            </div>
            <div class="control-btns">
                <button class="btn-dont-know" onclick="app.markAsUnknown()">Don't Know (Repeat)</button>
                <button class="btn-know" onclick="app.markAsKnown()">Know (Remove)</button>
            </div>
        `;
    },

    markAsKnown() {
        this.activeWords.splice(this.currentIndex, 1);
        if (this.currentIndex >= this.activeWords.length) this.currentIndex = 0;
        this.render();
    },

    markAsUnknown() {
        this.currentIndex = (this.currentIndex + 1) % this.activeWords.length;
        this.render();
    },

    renderLearn(container) {
        if (this.activeWords.length === 0) {
            container.innerHTML = `
                <div class="completion-message">
                    <h2>🎯 Finished!</h2>
                    <p>You correctly identified all meanings.</p>
                    <button class="main-btn" onclick="app.switchMode('learn')">Learn Again</button>
                    <button class="main-btn" style="background-color: #95a5a6;" onclick="app.switchMode('overview')">Back to Overview</button>
                </div>
            `;
            return;
        }

        const correct = this.activeWords[this.currentIndex];
        // Randomly extract 3 distractors
        let distractors = this.words
            .filter(w => w !== correct)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
        
        let choices = [...distractors, correct].sort(() => 0.5 - Math.random());

        container.innerHTML = `
            <div class="mode-header">
                <h2>Learn Mode (MCQ)</h2>
                <div class="progress-bar">Challenges left: ${this.activeWords.length}</div>
            </div>
            <div class="quiz-container">
                <div style="font-size: 2.5rem; margin: 40px 0; font-weight: bold;">${correct.vocab}</div>
                <div class="quiz-options fade-in">
                    ${choices.map(choice => `
                        <button class="option-btn" onclick="app.checkAnswer(this, '${choice.definition}', '${correct.definition}')">
                            ${choice.definition}
                        </button>
                    `).join('')}
                </div>
                <div id="feedback-area" class="feedback-message"></div>
            </div>
        `;
    },

    checkAnswer(btnElement, selected, answer) {
        const options = document.querySelectorAll('.option-btn');
        const feedbackArea = document.getElementById('feedback-area');
        
        // Disable all buttons
        options.forEach(btn => btn.disabled = true);

        if (selected === answer) {
            btnElement.classList.add('correct');
            feedbackArea.innerHTML = `<span style="color: #2ecc71; font-weight: bold;">✨ Correct!</span>`;
            
            this.activeWords.splice(this.currentIndex, 1);
            if (this.currentIndex >= this.activeWords.length) this.currentIndex = 0;
        } else {
            btnElement.classList.add('incorrect');
            // Highlight the correct answer
            options.forEach(btn => {
                if (btn.innerText.trim() === answer) btn.classList.add('correct');
            });
            feedbackArea.innerHTML = `<span style="color: #e74c3c; font-weight: bold;">❌ Incorrect. The answer is [${answer}].</span>`;
            
            this.currentIndex = (this.currentIndex + 1) % this.activeWords.length;
        }

        // Move to next after 1.5s
        setTimeout(() => {
            this.render();
        }, 1500);
    },

    prevWord() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.render();
        }
    }
};

window.onload = () => app.init();

// --- Marketplace Logic ---
const market = {
    init() {
        this.renderMarketList();
    },

    upload() {
        const author = document.getElementById('author-name').value.trim();
        const title = document.getElementById('set-title').value.trim();
        const link = document.getElementById('set-link').value.trim();
        const desc = document.getElementById('set-desc').value.trim();

        if (!author || !title || !link) return alert("Author, Title, and Link are required.");

        let items = JSON.parse(localStorage.getItem('vocaQuizMarket') || '[]');
        items.unshift({
            title, link, desc, author,
            date: new Date().toLocaleDateString()
        });
        
        localStorage.setItem('vocaQuizMarket', JSON.stringify(items));
        alert("Successfully registered!");
        location.reload();
    },

    renderMarketList() {
        const grid = document.getElementById('market-grid');
        const items = JSON.parse(localStorage.getItem('vocaQuizMarket') || '[]');

        grid.innerHTML = items.map(item => `
            <div class="market-card fade-in">
                <h3>${item.title}</h3>
                <p>${item.desc || 'No description.'}</p>
                <div style="font-size:0.8rem; color:#999; margin-bottom:10px;">
                    By ${item.author} | ${item.date}
                </div>
                <button class="main-btn" style="width:100%; padding:10px;" 
                    onclick="localStorage.setItem('lastUrl', '${item.link}'); location.href='index.html?load=true'">
                    Study
                </button>
            </div>
        `).join('');
    }
};
