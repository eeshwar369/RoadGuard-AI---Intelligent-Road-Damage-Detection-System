const fs = require('fs');
const path = require('path');
const edgeimpulse = require('edge-impulse-linux');

const CONFIG = {
  modelPath: '../model/modelfile.eim',
  testDataPath: '../data/processed/test',
  outputPath: './results'
};

const CLASSES = [
  'D00-longitudinal-crack',
  'D10-transverse-crack',
  'D20-alligator-crack',
  'D40-pothole'
];

class ModelEvaluator {
  constructor() {
    this.model = null;
    this.results = {
      totalImages: 0,
      correctPredictions: 0,
      confusionMatrix: {},
      classMetrics: {},
      inferenceTimes: [],
      timestamp: new Date().toISOString()
    };
    
    // Initialize confusion matrix
    CLASSES.forEach(cls1 => {
      this.results.confusionMatrix[cls1] = {};
      CLASSES.forEach(cls2 => {
        this.results.confusionMatrix[cls1][cls2] = 0;
      });
    });
  }

  async loadModel() {
    console.log('Loading Edge Impulse model...');
    this.model = new edgeimpulse.ImageClassifier(CONFIG.modelPath);
    await this.model.init();
    console.log('✓ Model loaded successfully\n');
  }

  async evaluateTestSet() {
    console.log('Starting evaluation on test set...\n');
    
    for (const trueClass of CLASSES) {
      const classDir = path.join(CONFIG.testDataPath, trueClass);
      
      if (!fs.existsSync(classDir)) {
        console.log(`Warning: ${classDir} not found, skipping...`);
        continue;
      }

      const images = fs.readdirSync(classDir)
        .filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      
      console.log(`Evaluating ${images.length} images for ${trueClass}...`);
      
      for (const imgFile of images) {
        const imgPath = path.join(classDir, imgFile);
        await this.evaluateImage(imgPath, trueClass);
      }
    }
    
    this.calculateMetrics();
    this.saveResults();
    this.printReport();
  }

  async evaluateImage(imagePath, trueClass) {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      
      const startTime = Date.now();
      const result = await this.model.classify(imageBuffer);
      const inferenceTime = Date.now() - startTime;
      
      this.results.inferenceTimes.push(inferenceTime);
      this.results.totalImages++;
      
      const predictions = result.result.classification;
      const predictedClass = Object.entries(predictions)
        .sort((a, b) => b[1] - a[1])[0][0];
      
      // Update confusion matrix
      this.results.confusionMatrix[trueClass][predictedClass]++;
      
      if (predictedClass === trueClass) {
        this.results.correctPredictions++;
      }
      
    } catch (err) {
      console.error(`Error evaluating ${imagePath}:`, err.message);
    }
  }

  calculateMetrics() {
    console.log('\nCalculating metrics...');
    
    CLASSES.forEach(cls => {
      const tp = this.results.confusionMatrix[cls][cls];
      
      // False positives: predicted as cls but actually other classes
      let fp = 0;
      CLASSES.forEach(otherCls => {
        if (otherCls !== cls) {
          fp += this.results.confusionMatrix[otherCls][cls];
        }
      });
      
      // False negatives: actually cls but predicted as other classes
      let fn = 0;
      CLASSES.forEach(otherCls => {
        if (otherCls !== cls) {
          fn += this.results.confusionMatrix[cls][otherCls];
        }
      });
      
      const precision = tp / (tp + fp) || 0;
      const recall = tp / (tp + fn) || 0;
      const f1 = 2 * (precision * recall) / (precision + recall) || 0;
      
      this.results.classMetrics[cls] = {
        precision: precision.toFixed(4),
        recall: recall.toFixed(4),
        f1Score: f1.toFixed(4),
        support: tp + fn
      };
    });
    
    // Overall accuracy
    this.results.accuracy = 
      (this.results.correctPredictions / this.results.totalImages).toFixed(4);
    
    // Average inference time
    const avgInference = this.results.inferenceTimes.reduce((a, b) => a + b, 0) / 
      this.results.inferenceTimes.length;
    this.results.avgInferenceTime = avgInference.toFixed(2);
    this.results.minInferenceTime = Math.min(...this.results.inferenceTimes);
    this.results.maxInferenceTime = Math.max(...this.results.inferenceTimes);
  }

  saveResults() {
    if (!fs.existsSync(CONFIG.outputPath)) {
      fs.mkdirSync(CONFIG.outputPath, { recursive: true });
    }
    
    const resultsFile = path.join(CONFIG.outputPath, 'evaluation_results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`\n✓ Results saved to ${resultsFile}`);
    
    // Save confusion matrix as CSV
    this.saveConfusionMatrixCSV();
  }

  saveConfusionMatrixCSV() {
    const csvPath = path.join(CONFIG.outputPath, 'confusion_matrix.csv');
    let csv = 'True\\Predicted,' + CLASSES.join(',') + '\n';
    
    CLASSES.forEach(trueClass => {
      const row = [trueClass];
      CLASSES.forEach(predClass => {
        row.push(this.results.confusionMatrix[trueClass][predClass]);
      });
      csv += row.join(',') + '\n';
    });
    
    fs.writeFileSync(csvPath, csv);
    console.log(`✓ Confusion matrix saved to ${csvPath}`);
  }

  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('EVALUATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\nTotal Images: ${this.results.totalImages}`);
    console.log(`Correct Predictions: ${this.results.correctPredictions}`);
    console.log(`Overall Accuracy: ${(this.results.accuracy * 100).toFixed(2)}%`);
    
    console.log(`\nInference Time:`);
    console.log(`  Average: ${this.results.avgInferenceTime}ms`);
    console.log(`  Min: ${this.results.minInferenceTime}ms`);
    console.log(`  Max: ${this.results.maxInferenceTime}ms`);
    
    console.log('\nPer-Class Metrics:');
    console.log('-'.repeat(60));
    console.log('Class'.padEnd(30) + 'Precision  Recall  F1-Score  Support');
    console.log('-'.repeat(60));
    
    CLASSES.forEach(cls => {
      const metrics = this.results.classMetrics[cls];
      const label = cls.padEnd(30);
      const precision = (metrics.precision * 100).toFixed(1).padStart(6);
      const recall = (metrics.recall * 100).toFixed(1).padStart(6);
      const f1 = (metrics.f1Score * 100).toFixed(1).padStart(6);
      const support = metrics.support.toString().padStart(7);
      
      console.log(`${label}${precision}%  ${recall}%  ${f1}%  ${support}`);
    });
    
    console.log('\nConfusion Matrix:');
    console.log('-'.repeat(60));
    console.log('See confusion_matrix.csv for detailed breakdown');
    console.log('='.repeat(60) + '\n');
  }
}

// Run evaluation
async function main() {
  const evaluator = new ModelEvaluator();
  
  try {
    await evaluator.loadModel();
    await evaluator.evaluateTestSet();
  } catch (err) {
    console.error('Evaluation failed:', err.message);
    console.log('\nMake sure:');
    console.log('1. Model is exported from Edge Impulse');
    console.log('2. Test data is prepared in data/processed/test/');
    console.log('3. edge-impulse-nodejs is installed');
  }
}

if (require.main === module) {
  main();
}

module.exports = { ModelEvaluator };
