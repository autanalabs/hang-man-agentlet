/**
 * @license
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author
 * gigonzalezs [gb@autanalabs.com]
 */

/**
 * Agentlet Web Component
 * 
 * This abstract class defines a custom HTML element for use in a shell-based web application.
 * It provides a mechanism for communication between the shell and micro frontends ("agentlets").
 * 
 * Key Features:
 * - Listens for attribute changes (specifically 'message') and processes JSON-based instructions.
 * - Delegates tool invocations and messages to subclass implementations.
 * - Provides static utilities for registration and tag name normalization.
 * 
 * Required Overrides (Subclasses must implement):
 * - onMessageFromShell(message): Handle messages that are not valid tool instructions.
 * - onToolCall(toolName, params): Handle tool instructions.
 * - render(): Render the component's shadow DOM.
 * - agentletId (static getter): Return the manifest info for registration and tag name generation.
 * 
 * Usage:
 * - Extend the Agentlet class.
 * - Implement required methods.
 * - Register the agentlet using Agentlet.register().
 * 
 * Version: 1.0.0
 */
export class Agentlet extends HTMLElement {

    static observedAttributes = ['message'];

    /**
     * Initializes the agentlet and attaches a shadow DOM.
     */
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    /**
     * Lifecycle hook called when the element is added to the DOM.
     * Automatically calls render().
     */
    connectedCallback() {
        this.render();
    }

    /**
     * Handles changes to observed attributes.
     * Specifically processes the 'message' attribute to trigger tool calls or handle shell messages.
     * 
     * @param {string} name - The name of the changed attribute.
     * @param {string} oldValue - The old value of the attribute.
     * @param {string} newValue - The new value of the attribute.
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (name !== 'message') return;

        console.log(`Agentlet: message received: ${newValue}`);

        try {
            const parsed = JSON.parse(newValue);

            if (typeof parsed === 'object' && parsed.tool) {
                const response = this.onToolCall(parsed.tool, parsed.params);
                if (response !== undefined) {
                    const toolResponse = {
                        type: 'tool_response',
                        tool: parsed.tool,
                        params: parsed.params,
                        response: response
                    };
                    console.log(`Agentlet: sending tool response to shell: ${toolResponse}`);
                    Agentlet.shell.sendMessageToShell(JSON.stringify(toolResponse));

                }
            } else {
                // JSON válido pero no cumple con formato esperado de tool
                console.log(`Agentlet: JSON válido pero no cumple con formato esperado de tool.`);
                this.onMessageFromShell(newValue);
            }
        } catch (e) {
            console.log(`Agentlet: message error: ${e}`);
            this.onMessageFromShell(newValue);
        }
    }

    /**
     * Abstract function called when a valid JSON message does not contain a tool instruction.
     * Subclasses must override this to implement specific message handling.
     * 
     * @param {string} message - The raw message from the shell.
     * @throws {Error} If not implemented by subclass.
     */
    onMessageFromShell(message) {
        throw new Error('The onMessageFromShell function must be implemented by subclasses.');
    }

    /**
     * Abstract function called when a message contains a tool instruction.
     * Subclasses must override this to implement tool logic.
     * 
     * Expected return format:
     * - On success:
     *   {
     *     status: 'OK',
     *     message: 'Tablero borrado. Se devuelve estado actual del tablero.',
     *     response: Object // current board state
     *   }
     * - On error:
     *   {
     *     status: 'ERROR',
     *     message: 'ERROR: La posición row=x, col=y ya estaba ocupada por el jugador z. Intenta de nuevo.'
     *   }
     * 
     * @param {string} toolName - The name of the tool to call.
     * @param {any} params - Parameters to pass to the tool.
     * @returns {Object} Response object in the specified format.
     * @throws {Error} If not implemented by subclass.
     */
    onToolCall(toolName, params) {
        throw new Error('The onToolCall function must be implemented by subclasses.');
    }

    /**
     * Abstract Render method for drawing the component in the shadow DOM.
     * Subclasses must override this.
     * @throws {Error} If not implemented by subclass.
     */
    render() {
        throw new Error('The render method must be implemented by subclasses.');
    }

    /**
     * Returns the microManifest metadata required for registration and tag name construction.
     * Subclasses must override this to provide their own manifest.
     * 
     * Expected return format:
     * {
     *   manifestVersion: '1.1.0-mini',
     *   name: 'Tic Tac Toe',
     *   version: '0.1.1',
     *   groupId: 'io.ggobuk',
     *   artifactId: 'builtin',
     *   tagName: 'tic-tac-toe'
     * }
     * 
     * @returns {Object} The micro frontend manifest in "mini" format (microManifest).
     * @throws {Error} If not implemented by subclass.
     */
    static get agentletId() {
        throw new Error('The agentletId getter must be implemented by subclasses.');
    }

    /**
     * Builds a normalized custom element tag name using manifest details.
     * 
     * @param {Object} microManifest - The manifest object with groupId, artifactId, tagName, and version.
     * @returns {string} The normalized HTML tag name.
     */
    static buildNormalizedTagName(microManifest) {
        const normalizedGroupId = microManifest.groupId
            .replaceAll('.', '-');
        const normalizedArtifact = microManifest.artifactId
            .replaceAll('.', '-');
        const name = microManifest.tagName;
        const normalizedVersion = microManifest.version
            .replaceAll('.', '-');
        const tagName = `${normalizedGroupId}-${normalizedArtifact}-${name}-${normalizedVersion}`;
        return tagName;
    }

    /**
     * Registers an agentlet as a custom element using its manifest data.
     * Also informs the shell of the new agentlet.
     * 
     * @param {typeof Agentlet} constructor - The class constructor extending Agentlet.
     */
    static register(constructor) {
        const microManifest = constructor.agentletId;
        const normalizedTagName = constructor.buildNormalizedTagName(microManifest);
        customElements.define(normalizedTagName, constructor);
        this.shell.registerAgentlet(microManifest)
        console.log(`Agentlet '${microManifest.name}' version ${microManifest.version} registered with HTML tag: <${normalizedTagName}>`);
    }

    /**
     * Provides access to the shell object attached to the global window.
     * 
     * @returns {Object} The shell interface.
     */
    static get shell() {
        return window.agentlet_shell;
    }
}

if (!window.agentlet_shell) {
    console.log('WARNING: window.agentlet_shell not detected!!!');
}

/**
 * Logs a stylized ASCII logo for Agentlet in the console.
 */
function showLogo() {
    const logo = `
            █████╗  ██████╗  ███████╗ ███╗   ██╗████████╗██╗     ███████╗████████╗
            ██╔══██╗██╔════╝  ██╔════╝ ████╗  ██║╚══██╔══╝██║     ██╔════╝╚══██╔══╝
            ███████║██║  ███║ █████╗   ██╔██╗ ██║   ██║   ██║     █████╗     ██║
            ██╔══██║██║   ██║ ██╔══╝   ██║╚██╗██║   ██║   ██║     ██╔══╝     ██║
            ██║  ██║╚██████╔╝ ███████╗ ██║ ╚████║   ██║   ███████╗███████╗   ██║
            ╚═╝  ╚═╝ ╚═════╝  ╚══════╝ ╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚══════╝   ╚═╝

            A G E N T L E T  - 1 . 0 . 0
            `;

    console.log(logo);
}

// Ejecuta la función para mostrar el logo
showLogo();