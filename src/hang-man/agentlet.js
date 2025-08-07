import { Agentlet } from '../lib/agentlet-1.0.0.js';

class HangmanAgentlet extends Agentlet {

    static get agentletId() {
        return {
            manifestVersion: "1.1.0-mini",
            name: "Hangman",
            version: "0.1.0",
            groupId: "io.ggobuk",
            artifactId: "hangman",
            tagName: "hangman-game"
        };
    }

    constructor() {
        super();
        this._secretWord = '';
        this._guessedLetters = new Set();
        this._incorrectLetters = new Set();
        this._maxAttempts = 6;
        this._remainingAttempts = this._maxAttempts;
        this._gameOver = false;
        this._aiTurn = false;

        this._handleKeyUp = this._handleKeyUp.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('keyup', this._handleKeyUp);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keyup', this._handleKeyUp);
    }

    _handleKeyUp(event) {
        if (this._gameOver || !this._secretWord || this._aiTurn) return;

        const key = event.key.toLowerCase();
        if (!/^[a-z]$/.test(key)) return;
        if (this._guessedLetters.has(key) || this._incorrectLetters.has(key)) {
            this._sendMessage(`El usuario ya había intentado la letra '${key}'. Ignorada.`);
            return;
        }

        if (this._secretWord.includes(key)) {
            this._guessedLetters.add(key);
            this._sendMessage(`El usuario presionó la letra '${key}', y fue correcta.`);
        } else {
            this._incorrectLetters.add(key);
            this._remainingAttempts--;
            this._sendMessage(`El usuario presionó la letra '${key}', y fue incorrecta. Le quedan ${this._remainingAttempts} intentos.`);
        }

        this.render();
        this._checkGameStatus();
    }

    _checkGameStatus() {
        const revealed = this._secretWord.split('').every(char => this._guessedLetters.has(char));
        if (revealed) {
            this._gameOver = true;
            this._sendMessage(`¡El usuario adivinó correctamente la palabra secreta '${this._secretWord}'!`);
        } else if (this._remainingAttempts <= 0) {
            this._gameOver = true;
            this._sendMessage(`El usuario falló. La palabra secreta era '${this._secretWord}'.`);
        }
    }

    _sendMessage(text) {
        Agentlet.shell.sendMessageToShell(JSON.stringify({
            type: 'message',
            message: text
        }));
    }

    onToolCall(toolName, params) {
        switch (toolName) {
            case 'startTurnAsUser':
            case 'agentlet_startTurnAsUser':
                if (params && typeof params.word === 'string') {
                    this._startGame(params.word.toLowerCase());
                    return {
                        status: 'OK',
                        message: 'Juego iniciado. Turno del usuario.',
                        response: {}
                    };
                }
                return {
                    status: 'ERROR',
                    message: 'Parámetro "word" faltante o inválido.'
                };
            case 'agentlet_guessLetter':
                if (params && typeof params.letter === 'string') {
                    return this._processAIGuess(params.letter.toLowerCase());
                }
                return {
                    status: 'ERROR',
                    message: 'Parámetro "letter" faltante o inválido.'
                };
            case 'agentlet_submitSecretWord':
                if (params && typeof params.word === 'string') {
                    this._startGameAsAI(params.word.toLowerCase());
                    return {
                        status: 'OK',
                        message: 'Juego iniciado. Turno de la IA.',
                        response: {}
                    };
                }
                return {
                    status: 'ERROR',
                    message: 'Parámetro "word" faltante o inválido.'
                };
            case 'agentlet_resetGame':
                this._resetGame();
                return {
                    status: 'OK',
                    message: 'Juego reiniciado.',
                    response: {}
                };
            default:
                return {
                    status: 'ERROR',
                    message: `Tool no reconocida: ${toolName}`
                };
        }
    }

    _startGame(word) {
        this._secretWord = word;
        this._guessedLetters.clear();
        this._incorrectLetters.clear();
        this._remainingAttempts = this._maxAttempts;
        this._gameOver = false;
        this._aiTurn = false;
        this._sendMessage("Comienza el turno del usuario.");
        this.render();
    }

    _startGameAsAI(word) {
        this._secretWord = word;
        this._guessedLetters.clear();
        this._incorrectLetters.clear();
        this._remainingAttempts = this._maxAttempts;
        this._gameOver = false;
        this._aiTurn = true;
        this._sendMessage("Comienza el turno de la IA.");
        this.render();
    }

    _resetGame() {
        this._secretWord = '';
        this._guessedLetters.clear();
        this._incorrectLetters.clear();
        this._remainingAttempts = this._maxAttempts;
        this._gameOver = false;
        this._aiTurn = false;
        this.render();
        this._sendMessage("Juego reiniciado. A la espera de que se inicie un turno.");
    }

    _processAIGuess(letter) {
        if (this._gameOver || !this._aiTurn) {
            return {
                status: 'ERROR',
                message: 'No es el turno de la IA o el juego ha terminado.'
            };
        }

        if (this._guessedLetters.has(letter) || this._incorrectLetters.has(letter)) {
            return {
                status: 'ERROR',
                message: `La letra '${letter}' ya fue intentada.`
            };
        }

        if (this._secretWord.includes(letter)) {
            this._guessedLetters.add(letter);
            this._sendMessage(`La IA adivinó la letra '${letter}', y fue correcta.`);
        } else {
            this._incorrectLetters.add(letter);
            this._remainingAttempts--;
            this._sendMessage(`La IA adivinó la letra '${letter}', y fue incorrecta. Le quedan ${this._remainingAttempts} intentos.`);
        }

        this.render();
        return this._checkAIGameStatus();
    }

    _checkAIGameStatus() {
        const revealed = this._secretWord.split('').every(char => this._guessedLetters.has(char));
        if (revealed) {
            this._gameOver = true;
            this._sendMessage(`¡La IA adivinó correctamente la palabra secreta '${this._secretWord}'!`);
        } else if (this._remainingAttempts <= 0) {
            this._gameOver = true;
            this._sendMessage(`La IA falló. La palabra secreta era '${this._secretWord}'.`);
        }

        return {
            status: 'OK',
            message: 'Estado actualizado.',
            response: {}
        };
    }

    onMessageFromShell(message) {
        console.log(`hangman: message received: ${message}`);
    }

    render() {
        const masked = this._secretWord.split('').map(letter =>
            this._guessedLetters.has(letter) ? letter : '_'
        ).join(' ');

        const incorrect = Array.from(this._incorrectLetters).join(', ');

        this.shadowRoot.innerHTML = `
            <style>
                .word { font-size: 32px; letter-spacing: 8px; }
                .info { margin-top: 10px; font-size: 18px; }
            </style>
            <div class="word">${masked}</div>
            <div class="info">Letras incorrectas: ${incorrect}</div>
            <div class="info">Intentos restantes: ${this._remainingAttempts}</div>
        `;
    }
}

Agentlet.register(HangmanAgentlet);