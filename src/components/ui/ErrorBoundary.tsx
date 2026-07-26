// React-foutgrens (#733). Zonder dit unmount React 19 bij een onafgevangen
// renderfout de héle boom: wit scherm, geen melding, geen weg terug behalve
// zelf herladen. Een classcomponent is verplicht — er is geen hook-equivalent
// voor getDerivedStateFromError/componentDidCatch.
//
// Let op: een boundary vangt alléén fouten tijdens render, in lifecycles en in
// constructors van de boom eronder. Fouten in event-handlers en async code
// komen hier niet langs; die worden in een vervolg-PR opgepikt door globale
// listeners (window.onerror / unhandledrejection).

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorFallback, type CrashScope } from "./ErrorFallback";

interface Props {
  children: ReactNode;
  /** Waar deze boundary staat; komt terug in de logregel en bepaalt of de
   *  fallback het hele scherm vult. */
  scope: CrashScope;
  /** Wijzigt deze waarde, dan wist de boundary zijn fout. Geef hier de
   *  route-pathname mee, zodat wégnavigeren van een kapotte pagina werkt.
   *  Bewust een prop en geen `key` op de boundary zelf: een `key` unmount de
   *  subboom bij élke navigatie, ook als er niets stuk is, en gooit dan de
   *  Suspense-staat eronder weg. */
  resetKey?: string;
}

interface State {
  error: Error | null;
  /** De resetKey waarop de huidige staat gebaseerd is. */
  resetKey?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey === state.resetKey) return null;
    return { error: null, resetKey: props.resetKey };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Voorlopig alleen zichtbaar in de devtools; een vervolg-PR stuurt dit
    // door zodat crashes in productie niet stil blijven.
    console.error(`[crash:${this.props.scope}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <ErrorFallback
          error={error}
          scope={this.props.scope}
          onReset={this.reset}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
