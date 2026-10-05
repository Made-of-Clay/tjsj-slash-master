import { LoadingManager } from 'three/webgpu';

/**
 * Shared loader progress. Moved out of the starter template; step 9 is the
 * first step that actually loads a model.
 */
export function getLoadingManager(): LoadingManager {
    return new LoadingManager(
        () => console.log('Finished Loading'),
        (url, loaded, total) => console.log(`Loading: ${url} (${loaded}/${total})`),
        console.error,
    );
}
