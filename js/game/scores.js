/**
 * High Score Manager
 * Handles localStorage-based score persistence
 */

const STORAGE_KEY = 'snakeHighScores';
const MAX_SCORES = 5;

export class ScoreManager {
    constructor(listElement) {
        this.listElement = listElement;
    }

    getScores() {
        try {
            const scores = localStorage.getItem(STORAGE_KEY);
            return scores ? JSON.parse(scores) : [];
        } catch (e) {
            return [];
        }
    }

    save(score) {
        const scores = this.getScores();
        scores.push({
            score,
            date: new Date().toLocaleDateString()
        });

        scores.sort((a, b) => b.score - a.score);
        const topScores = scores.slice(0, MAX_SCORES);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(topScores));
        this.display();

        return topScores;
    }

    display() {
        const scores = this.getScores();
        this.listElement.innerHTML = scores.length
            ? scores.map((s, i) => `
                <li>
                    <span>#${i + 1}</span>
                    <span>${s.score}</span>
                </li>
            `).join('')
            : '<li><span style="width:100%;text-align:center">No scores yet</span></li>';
    }

    isHighScore(score) {
        const scores = this.getScores();
        if (scores.length < MAX_SCORES) return true;
        return score > scores[scores.length - 1].score;
    }
}
