import { spawn } from 'child_process';
import fs from 'fs';
import { AudioStats } from '../types.js';

export async function analyzeAudio(filePath: string): Promise<AudioStats> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new Error('File not found'));
        }

        // We will run ffprobe once for metadata
        const argsJson = [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            filePath
        ];

        let metadataOutput = '';
        let stderrOutput = '';
        const proc1 = spawn('ffprobe', argsJson);
        proc1.stdout.on('data', data => metadataOutput += data.toString());
        proc1.stderr.on('data', data => stderrOutput += data.toString());
        proc1.on('close', async (code) => {
            if (code !== 0) {
                return reject(new Error('ffprobe metadata analysis failed: ' + stderrOutput));
            }
            try {
                const metadata = JSON.parse(metadataOutput);
                const format = metadata.format || {};
                const audioStream = (metadata.streams || []).find((s: any) => s.codec_type === 'audio') || {};

                const bitrate = parseInt(format.bit_rate || audioStream.bit_rate || '0', 10);
                const sampleRate = parseInt(audioStream.sample_rate || '0', 10);
                const duration = parseFloat(format.duration || '0');
                const fileSize = fs.statSync(filePath).size;

                // Now run ffmpeg for ebur128 (loudness)
                // ffmpeg -i file -af ebur128=framelog=verbose -f null - 2>&1 | awk '/I:/{print $2} /True peak:/{print $3}'
                const ffmpegArgs = [
                    '-i', filePath,
                    '-af', 'ebur128=peak=true',
                    '-f', 'null',
                    '-y', '/dev/null'
                ];
                let eburOutput = '';
                const proc2 = spawn('ffmpeg', ffmpegArgs);
                proc2.stderr.on('data', data => eburOutput += data.toString());
                proc2.on('close', (code2) => {
                    if (code2 !== 0) {
                        console.warn('ffmpeg ebur128 failed', code2, eburOutput);
                        return reject(new Error('ffmpeg analysis failed: ' + eburOutput));
                    }

                    let lufs = 0;
                    let peakDb = 0;
                    let foundI = false;
                    let foundPeak = false;

                    // Parse eburOutput
                    // Look for:
                    // Integrated loudness:
                    //     I:         -14.2 LUFS
                    // True peak:
                    //     Peak:      -1.2 dBFS
                    const lines = eburOutput.split('\n');
                    for (const line of lines) {
                        if (line.includes('I:') && line.includes('LUFS')) {
                            const lMatch = line.match(/I:\s+([-\d.]+)\s+LUFS/);
                            if (lMatch) { lufs = parseFloat(lMatch[1]); foundI = true; }
                        }
                        if (line.includes('Peak:') && line.includes('dBFS')) {
                            const pMatch = line.match(/Peak:\s+([-\d.]+)\s+dBFS/);
                            if (pMatch) { peakDb = parseFloat(pMatch[1]); foundPeak = true; }
                        }
                    }

                    if (!foundI || !foundPeak) {
                        console.warn('ffmpeg ebur128 missing output or parse failed');
                        return reject(new Error('missing LUFS/peak metadata'));
                    }

                    resolve({
                        bitrate,
                        sampleRate,
                        lufs,
                        peakDb,
                        duration,
                        fileSize
                    });
                });
            } catch (e) {
                reject(e);
            }
        });
    });
}
