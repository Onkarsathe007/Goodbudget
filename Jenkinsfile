pipeline {
    agent any
    
    environment {
        // Docker Configuration
        DOCKER_IMAGE = 'onkarsathe007/goodbudget'
        DOCKER_REGISTRY = 'docker.io'
        
        // Build Configuration
        NODE_VERSION = '20'
        PNPM_VERSION = '10.26.0'
        
        // Paths
        PROJECT_ROOT = "${WORKSPACE}"
    }
    
    // Trigger only on prod branch
    triggers {
        githubPush()
    }
    
    options {
        // Keep last 10 builds
        buildDiscarder(logRotator(numToKeepStr: '10'))
        
        // Timeout after 30 minutes
        timeout(time: 30, unit: 'MINUTES')
        
        // Disable concurrent builds on same branch
        disableConcurrentBuilds()
        
        // Add timestamps to console output
        timestamps()
    }
    
    stages {
        stage('Checkout') {
            steps {
                script {
                    echo "🔍 Checking out code from prod branch..."
                    checkout scm
                    
                    // Get commit info for tagging
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    
                    env.BUILD_TAG = "${BUILD_NUMBER}-${GIT_COMMIT_SHORT}"
                    
                    echo "📦 Build Tag: ${BUILD_TAG}"
                }
            }
        }
        
        stage('Setup Environment') {
            steps {
                script {
                    echo "🔧 Setting up Node.js and pnpm..."
                    sh '''
                        # Verify Node version
                        node --version
                        
                        # Enable and install pnpm
                        corepack enable
                        corepack prepare pnpm@${PNPM_VERSION} --activate
                        
                        # Verify pnpm installation
                        pnpm --version
                    '''
                }
            }
        }
        
        stage('Install Dependencies') {
            steps {
                script {
                    echo "📦 Installing dependencies with pnpm..."
                    sh '''
                        # Install with frozen lockfile for consistency
                        pnpm install --frozen-lockfile
                    '''
                }
            }
        }
        
        // stage('Lint & Format Check') {
        //     steps {
        //         script {
        //             echo "🔍 Running Biome linting and format checks..."
        //             sh '''
        //                 # Run Biome checks (lint + format)
        //                 pnpm run check
        //             '''
        //         }
        //     }
        // }
        //
        // stage('Type Check') {
        //     steps {
        //         script {
        //             echo "🔍 Running TypeScript type checking..."
        //             sh '''
        //                 # Run TypeScript compiler in check mode (no emit)
        //                 pnpm exec tsc --noEmit
        //             '''
        //         }
        //     }
        // }
        //
        stage('Generate Prisma Client') {
            steps {
                script {
                    echo "🔧 Generating Prisma Client..."
                    sh '''
                        # Generate Prisma client for database operations
                        npx prisma generate
                    '''
                }
            }
        }
        
        stage('Build TypeScript') {
            steps {
                script {
                    echo "🏗️  Building TypeScript to JavaScript..."
                    sh '''
                        # Compile TypeScript
                        pnpm exec tsc
                        
                        # Verify build output
                        ls -la dist/
                    '''
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    echo "🐳 Building Docker image..."
                    sh """
                        docker build \
                            --build-arg BUILD_DATE=\$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
                            --build-arg VCS_REF=${GIT_COMMIT} \
                            --build-arg VERSION=${BUILD_TAG} \
                            -t ${DOCKER_IMAGE}:${BUILD_TAG} \
                            -t ${DOCKER_IMAGE}:${BUILD_NUMBER} \
                            -t ${DOCKER_IMAGE}:latest \
                            -f Dockerfile \
                            .
                    """
                    
                    echo "✅ Docker image built successfully"
                }
            }
        }
        
        stage('Test Docker Image') {
            steps {
                script {
                    echo "🧪 Testing Docker image..."
                    sh """
                        # Verify image exists
                        docker images | grep ${DOCKER_IMAGE}
                        
                        # Check image size
                        docker images ${DOCKER_IMAGE}:${BUILD_TAG} --format "Size: {{.Size}}"
                        
                        # Inspect image layers
                        docker history ${DOCKER_IMAGE}:${BUILD_TAG} --no-trunc
                    """
                }
            }
        }
        
        stage('Push to Docker Hub') {
            steps {
                script {
                    echo "🚀 Pushing Docker image to Docker Hub..."
                    withCredentials([
                        usernamePassword(
                            credentialsId: 'docker-hub',
                            usernameVariable: 'DOCKER_USERNAME',
                            passwordVariable: 'DOCKER_PASSWORD'
                        )
                    ]) {
                        sh """
                            # Login to Docker Hub
                            echo \$DOCKER_PASSWORD | docker login -u \$DOCKER_USERNAME --password-stdin
                            
                            # Push all tags
                            docker push ${DOCKER_IMAGE}:${BUILD_TAG}
                            docker push ${DOCKER_IMAGE}:${BUILD_NUMBER}
                            docker push ${DOCKER_IMAGE}:latest
                            
                            # Logout from Docker Hub
                            docker logout
                        """
                    }
                    
                    echo "✅ Successfully pushed to Docker Hub:"
                    echo "   - ${DOCKER_IMAGE}:${BUILD_TAG}"
                    echo "   - ${DOCKER_IMAGE}:${BUILD_NUMBER}"
                    echo "   - ${DOCKER_IMAGE}:latest"
                }
            }
        }
        
        stage('Cleanup') {
            steps {
                script {
                    echo "🧹 Cleaning up old Docker images..."
                    sh """
                        # Remove dangling images
                        docker image prune -f
                        
                        # Keep only last 3 builds, remove older ones
                        docker images ${DOCKER_IMAGE} --format "{{.Tag}}" | \
                        grep -E '^[0-9]+' | \
                        sort -rn | \
                        tail -n +4 | \
                        xargs -I {} docker rmi ${DOCKER_IMAGE}:{} || true
                    """
                }
            }
        }
    }
    
    post {
        success {
            script {
                echo """
                ✅ ============================================
                ✅  BUILD SUCCESSFUL
                ✅ ============================================
                
                📦 Docker Images Published:
                   • ${DOCKER_IMAGE}:${BUILD_TAG}
                   • ${DOCKER_IMAGE}:${BUILD_NUMBER}
                   • ${DOCKER_IMAGE}:latest
                
                🚀 Deployment Command:
                   docker pull ${DOCKER_IMAGE}:latest
                   docker run -d -p 3000:3000 --env-file .env ${DOCKER_IMAGE}:latest
                
                ============================================
                """
            }
        }
        
        failure {
            script {
                echo """
                ❌ ============================================
                ❌  BUILD FAILED
                ❌ ============================================
                
                Build #${BUILD_NUMBER} failed at stage: ${env.STAGE_NAME}
                Commit: ${GIT_COMMIT_SHORT}
                Branch: ${env.BRANCH_NAME}
                
                Please check the console output for details.
                ============================================
                """
            }
        }
        
        unstable {
            echo "⚠️  Build unstable - some tests may have failed"
        }
        
        always {
            script {
                echo "🔍 Build Summary:"
                echo "   Build Number: ${BUILD_NUMBER}"
                echo "   Build Tag: ${BUILD_TAG}"
                echo "   Git Commit: ${GIT_COMMIT_SHORT}"
                echo "   Duration: ${currentBuild.durationString}"
            }
        }
    }
}
