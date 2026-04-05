# Set your credentials
export AWS_ACCESS_KEY_ID="06d5508a4bcc1a07e6ffd71c23280f2e"
export AWS_SECRET_ACCESS_KEY="5fa97683c55c9ea2245fa24ecea0f2f25fba8d9285baf260b8aff3cf848bb577"
export ACCOUNT_ID="34f209114d5c1098db508bd78ae5cbdf"
export BUCKET_NAME="audio"

# Upload a file
cd /Users/amehta/Documents/work/apps/parttimechiller/public/mixes

# Install aws-cli if you don't have it
brew install awscli

# Configure endpoint and upload
aws s3 cp TamarakMix_PTC.mp3 \
  s3://${BUCKET_NAME}/TamarakMix_PTC.mp3 \
  --endpoint-url https://${ACCOUNT_ID}.r2.cloudflarestorage.com