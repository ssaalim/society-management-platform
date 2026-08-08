#!/bin/bash

# Fix Backgrounds
find apps/frontend/src -name "*.tsx" -exec perl -pi -e 's/(?<!dark:)bg-(emerald|red|amber|yellow|orange|blue|cyan)-950(\/[0-9]{2})?/bg-$1-50 dark:bg-$1-950$2/g' {} +

# Fix Text
find apps/frontend/src -name "*.tsx" -exec perl -pi -e 's/(?<!dark:)text-(emerald|red|amber|yellow|orange|blue|cyan)-400/text-$1-700 dark:text-$1-400/g' {} +

# Fix Borders
find apps/frontend/src -name "*.tsx" -exec perl -pi -e 's/(?<!dark:)border-(emerald|red|amber|yellow|orange|blue|cyan)-(900|800)(\/[0-9]{2})?/border-$1-200 dark:border-$1-$2$3/g' {} +
