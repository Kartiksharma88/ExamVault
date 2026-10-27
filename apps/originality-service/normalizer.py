import re
import unicodedata
from typing import List, Tuple

# English stopwords (concise standard set)
ENGLISH_STOPWORDS = {
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
    'will', 'with', 'the', 'this', 'but', 'they', 'have', 'had', 'what', 'when',
    'where', 'who', 'which', 'why', 'how'
}

# Hindi stopwords (Devanagari)
HINDI_STOPWORDS = {
    'का', 'के', 'की', 'को', 'में', 'पर', 'से', 'है', 'हैं', 'था', 'थी', 'थे',
    'और', 'या', 'तो', 'भी', 'ने', 'हो', 'होता', 'होती', 'होते', 'किया', 'गया',
    'द्वारा', 'इस', 'उस', 'यह', 'वह', 'एक', 'जो', 'नहीं', 'कर'
}

class Normalizer:
    @staticmethod
    def normalize_latex(text: str) -> str:
        """
        Normalize LaTeX math expressions:
        - Strip presentation wrappers like \\textbf{}, \\textit{}, \\mathrm{}, \\text{}
        - Normalize common math operators \\times -> *, \\frac{a}{b} -> (a)/(b), \\cdot -> *
        - Strip dollar signs $ and $$
        - Retain variables, exponents, and numbers
        """
        if not text:
            return ""
        
        # Remove LaTeX comments
        text = re.sub(r'%.*$', '', text, flags=re.MULTILINE)
        
        # Convert fractions: \frac{a}{b} -> (a) / (b)
        text = re.sub(r'\\frac\{([^}]+)\}\{([^}]+)\}', r'(\1) / (\2)', text)
        
        # Strip text-wrapping commands \textbf{...}, \mathrm{...}, etc.
        text = re.sub(r'\\(textbf|textit|mathrm|mathbf|text|emph|underline)\{([^}]+)\}', r'\2', text)
        
        # Normalize symbols
        replacements = [
            (r'\\times', '*'),
            (r'\\cdot', '*'),
            (r'\\div', '/'),
            (r'\\pm', '+-'),
            (r'\\mp', '-+'),
            (r'\\le(q)?', '<='),
            (r'\\ge(q)?', '>='),
            (r'\\neq', '!='),
            (r'\\approx', '~='),
            (r'\\infty', 'infinity'),
            (r'\\sqrt\{([^}]+)\}', r'sqrt(\1)'),
            (r'\\pi', 'pi'),
            (r'\\theta', 'theta'),
            (r'\\alpha', 'alpha'),
            (r'\\beta', 'beta'),
            (r'\\gamma', 'gamma'),
            (r'\\lambda', 'lambda'),
            (r'\\mu', 'mu'),
            (r'\\sigma', 'sigma'),
            (r'\\omega', 'omega'),
            (r'\\Delta', 'delta'),
            (r'\\hat\{([^}]+)\}', r'\1'),
            (r'\\vec\{([^}]+)\}', r'\1'),
        ]
        for pattern, repl in replacements:
            text = re.sub(pattern, repl, text)
            
        # Strip remaining backslashes from unmatched simple commands
        text = re.sub(r'\\[a-zA-Z]+', ' ', text)
        
        # Strip math delimiters
        text = text.replace('$$', ' ').replace('$', ' ').replace('\\(', ' ').replace('\\)', ' ')
        
        return text

    @staticmethod
    def normalize_text(text: str, mask_numbers: bool = False, remove_stopwords: bool = False) -> str:
        r"""
        Complete normalization pipeline:
        1. Unicode NFKC normalization
        2. LaTeX stripping and math operator normalization
        3. Case folding (lowercase)
        4. Optional number masking (\d+ -> <NUM>)
        5. Whitespace and punctuation normalization
        6. Devanagari preserving tokenization
        """
        if not text:
            return ""

        # 1. Unicode NFKC
        text = unicodedata.normalize('NFKC', text)

        # 2. LaTeX normalize
        text = Normalizer.normalize_latex(text)

        # 3. Lowercase
        text = text.lower()

        # 4. Optional number masking
        if mask_numbers:
            # Replace floating point and integers with <NUM>
            text = re.sub(r'\b\d+(\.\d+)?\b', '<NUM>', text)

        # 5. Punctuation cleanup (preserving Devanagari characters: \u0900-\u097F and alphanumeric)
        # Keep letters, numbers, Devanagari, and token delimiters
        cleaned_chars = []
        for ch in text:
            if ch.isalnum() or '\u0900' <= ch <= '\u097F' or ch in ('<', '>', '_'):
                cleaned_chars.append(ch)
            else:
                cleaned_chars.append(' ')
        text = ''.join(cleaned_chars)

        # 6. Whitespace collapse
        tokens = text.split()

        # 7. Optional stopword removal
        if remove_stopwords:
            tokens = [t for t in tokens if t not in ENGLISH_STOPWORDS and t not in HINDI_STOPWORDS]

        return ' '.join(tokens)

    @staticmethod
    def get_shingles(text: str, k: int = 3) -> List[str]:
        """Generate word k-shingles"""
        words = text.split()
        if len(words) < k:
            return [' '.join(words)] if words else []
        return [' '.join(words[i:i+k]) for i in range(len(words) - k + 1)]

    @staticmethod
    def get_char_shingles(text: str, k: int = 5) -> List[str]:
        """Generate character k-shingles (effective for short text & Devanagari)"""
        clean = text.replace(' ', '')
        if len(clean) < k:
            return [clean] if clean else []
        return [clean[i:i+k] for i in range(len(clean) - k + 1)]
