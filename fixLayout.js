const fs = require('fs');
let code = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8');

// Replace standard MaterialIcons with IconSymbol
code = code.replace(
  /import \{ MaterialIcons \} from "@expo\/vector-icons";/,
  `import { MaterialIcons } from "@expo/vector-icons";\nimport { IconSymbol } from "../../components/ui/icon-symbol";`
);

fs.writeFileSync('app/(tabs)/_layout.tsx', code);
