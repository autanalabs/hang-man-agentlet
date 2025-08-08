import { Agentlet } from '../lib/agentlet-1.0.0.js';

class HangmanAgentlet extends Agentlet {

    static get agentletId() {
        return {
            manifestVersion: "1.1.0-mini",
            name: "Hangman",
            version: "0.1.1",
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
    }

    connectedCallback() {
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }


    _handleVirtualKey(letter) {
        if (this._gameOver || !this._secretWord || this._aiTurn) return;
        const key = String(letter).toLowerCase();
        if (!/^[a-zñáéíóú]$/.test(key)) return;
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
                    this._aiTurn = false;
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
            case 'guessLetter':
            case 'agentlet_guessLetter':
                if (params && typeof params.letter === 'string') {
                    return this._processAIGuess(params.letter.toLowerCase());
                }
                return {
                    status: 'ERROR',
                    message: 'Parámetro "letter" faltante o inválido.'
                };
            case 'submitSecretWord':
            case 'agentlet_submitSecretWord':
                if (params && typeof params.word === 'string') {
                    this._startGameAsAI(params.word.toLowerCase());
                    this._aiTurn = true;
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
            case 'resetGame':
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
        this.render();
    }

    _startGameAsAI(word) {
        this._secretWord = word;
        this._guessedLetters.clear();
        this._incorrectLetters.clear();
        this._remainingAttempts = this._maxAttempts;
        this._gameOver = false;
        this._aiTurn = true;
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

        let correctness;
        if (this._secretWord.includes(letter)) {
            this._guessedLetters.add(letter);
            correctness = 'correcta';
        } else {
            this._incorrectLetters.add(letter);
            this._remainingAttempts--;
            correctness = 'incorrecta';
        }

        this.render();
        const statusInfo = this._checkAIGameStatus();

        // Armar mensaje único para la tool_response
        let msg = `La IA intentó la letra '${letter}', y fue ${correctness}.`;
        msg += ` Intentos restantes: ${this._remainingAttempts}.`;
        if (statusInfo.gameOver) {
            msg += statusInfo.won ? ` ¡La IA adivinó la palabra secreta '${this._secretWord}'!`
                : ` La IA falló. La palabra secreta era '${this._secretWord}'.`;
        }

        return {
            status: 'OK',
            message: msg,
            response: {
                gameOver: statusInfo.gameOver,
                won: !!statusInfo.won,
                remainingAttempts: this._remainingAttempts,
                guessedLetters: Array.from(this._guessedLetters),
                incorrectLetters: Array.from(this._incorrectLetters),
                masked: this._secretWord.split('').map(ch => this._guessedLetters.has(ch) ? ch : '_').join(' ')
            }
        };
    }

    _checkAIGameStatus() {
        const revealed = this._secretWord.split('').every(char => this._guessedLetters.has(char));
        if (revealed) {
            this._gameOver = true;
            return { gameOver: true, won: true };
        }
        if (this._remainingAttempts <= 0) {
            this._gameOver = true;
            return { gameOver: true, won: false };
        }
        return { gameOver: false };
    }

    /**
    * Devuelve un SVG con la horca y las partes del muñeco.
    * Se dibujan progresivamente según `fails` (0..6):
    * 1 cabeza, 2 tronco, 3 brazo izq, 4 brazo der, 5 pierna izq, 6 pierna der.
    */
    _getHangmanSVG(fails) {
        const gallows = `
    <line x1="20"  y1="200" x2="180" y2="200" stroke="#111" stroke-width="4" />
    <line x1="60"  y1="200" x2="60"  y2="20"  stroke="#111" stroke-width="4" />
    <line x1="60"  y1="20"  x2="200" y2="20"  stroke="#111" stroke-width="4" />
    <line x1="60"  y1="60"  x2="100" y2="20"  stroke="#111" stroke-width="4" />
    <line x1="200" y1="20"  x2="200" y2="50"  stroke="#111" stroke-width="3" />
  `;
        const head = fails >= 1 ? `<circle cx="200" cy="68" r="18" stroke="#111" stroke-width="3" fill="none" />` : '';
        const body = fails >= 2 ? `<line x1="200" y1="86" x2="200" y2="130" stroke="#111" stroke-width="3" />` : '';
        const armL = fails >= 3 ? `<line x1="200" y1="98" x2="178" y2="116" stroke="#111" stroke-width="3" />` : '';
        const armR = fails >= 4 ? `<line x1="200" y1="98" x2="222" y2="116" stroke="#111" stroke-width="3" />` : '';
        const legL = fails >= 5 ? `<line x1="200" y1="130" x2="184" y2="162" stroke="#111" stroke-width="3" />` : '';
        const legR = fails >= 6 ? `<line x1="200" y1="130" x2="216" y2="162" stroke="#111" stroke-width="3" />` : '';

        return `
    <svg class="hangman-svg" viewBox="0 0 240 220" width="100%" height="220" role="img" aria-label="Estado del ahorcado">
      <g>
        ${gallows}
        ${head}${body}${armL}${armR}${legL}${legR}
      </g>
    </svg>
  `;
    }

    onMessageFromShell(message) {
        console.log(`hangman: message received: ${message}`);
    }

    render() {

        const fails = this._maxAttempts - this._remainingAttempts;
        const svg = this._getHangmanSVG(fails);
        
        const masked = this._secretWord.split('').map(letter =>
            this._guessedLetters.has(letter) ? letter : '_'
        ).join(' ');

        const incorrect = Array.from(this._incorrectLetters).join(', ');

        const isUserTurn = !this._aiTurn && !!this._secretWord && !this._gameOver;
        const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'ñ', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
        const keyboardHTML = isUserTurn ? `
            <div class="keyboard">
                ${keys.map(k => {
            const disabled = this._guessedLetters.has(k) || this._incorrectLetters.has(k) ? 'disabled' : '';
            return `<button class="key" data-letter="${k}" ${disabled}>${k.toUpperCase()}</button>`;
        }).join('')}
            </div>
        ` : '';

        // Compute statusText as per instructions
        let statusText = '';
        if (this._gameOver) {
            statusText = "Partida terminada";
        } else if (this._aiTurn) {
            statusText = "Turno de la IA";
        } else if (this._secretWord) {
            statusText = "Turno del usuario";
        } else {
            statusText = "Esperando inicio";
        }

        this.shadowRoot.innerHTML = `
            <style>
                .word { font-size: 32px; letter-spacing: 8px; text-align: center; }
                .info { margin-top: 10px; font-size: 18px; text-align: center; }
                .keyboard { margin-top: 16px; display: grid; grid-template-columns: repeat(14, 1fr); gap: 6px; }
                .key { padding: 8px 6px; font-size: 14px; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; background: #f9f9f9; }
                .key[disabled] { opacity: 0.5; cursor: not-allowed; }
                .agentlet-wrapper {
                    display: flex;
                    justify-content: center;
                    margin-top: 24px;
                    
                }
                .agentlet-frame {
                    display: inline-block;
                    padding: 16px 24px;
                    border: 2px solid #d9d9d9;
                    border-radius: 10px;
                    background: #fff;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.08);
                }
                .status-center {
                    text-align: center;
                    font-weight: bold;
                    font-size: 18px;
                    margin-bottom: 8px;
                }
                .top-controls {
                    text-align: center;
                    margin-bottom: 16px;
                }
                .top-controls button {
                    padding: 6px 12px;
                    font-size: 14px;
                    cursor: pointer;
                }
                .hangman-svg { display: block; margin: 0 auto 8px auto; }
                .word { color: #0a4dff; } /* azul, como tu referencia */
            </style>
            <div class="agentlet-wrapper">
                <div class="agentlet-frame">
                    <div class="status-center">Estado: ${statusText}</div>
                    <div class="top-controls">
                        <button id="resetBtn">Reiniciar</button>
                    </div>
                    ${svg}
                    <div class="word">${masked}</div>
                    <div class="info">Letras incorrectas: ${incorrect || '—'}</div>
                    <div class="info">Intentos restantes: ${this._remainingAttempts}</div>
                    ${keyboardHTML}
                </div>
            </div>
        `;
        if (isUserTurn) {
            this.shadowRoot.querySelectorAll('.key').forEach(btn => {
                btn.addEventListener('click', () => {
                    const letter = btn.getAttribute('data-letter');
                    this._handleVirtualKey(letter);
                });
            });
        }
        // Attach click listener to reset button
        const resetBtn = this.shadowRoot.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.onToolCall('agentlet_resetGame', {});
            });
        }

        
    }
}

Agentlet.register(HangmanAgentlet);