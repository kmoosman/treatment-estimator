import Papa from 'papaparse';

const CHUNK_SIZE = 1000000;

self.onmessage = function (e) {
    const file = e.data.file;
    let results = [];

    if (!file) {
        self.postMessage({ type: 'error', error: 'No file received.' });
        self.close();
        return;
    }

    Papa.parse(file, {
        header: true,
        worker: true,
        chunkSize: CHUNK_SIZE,
        chunk: function (chunk, parser) {
            results = results.concat(chunk.data);
            if (results.length >= CHUNK_SIZE) {
                self.postMessage({ type: 'result', data: results, fields: Object.keys(results[0]) });
                results = [];
            }
            const progress = (parser.streamer._input.bytesRead / file.size) * 100;
            self.postMessage({ type: 'progress', progress });
        },
        complete: function () {
            if (results.length > 0) {
                self.postMessage({ type: 'result', data: results, fields: Object.keys(results[0]) });
            }
            self.close();
        },
        error: function (error) {
            console.error('Parsing error:', error);
            self.postMessage({ type: 'error', error: error.message });
        }
    });
};
