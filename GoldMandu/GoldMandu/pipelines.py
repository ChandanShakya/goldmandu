import json
import os

class JsonHistoryPipeline:
    def open_spider(self, spider):
        self.file_path = '../../Values.json'
        # Ensure the directory for Values.json exists, if not, create it.
        # This is just a safety, as the root should exist.
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)

        if os.path.exists(self.file_path) and os.path.getsize(self.file_path) > 0:
            try:
                with open(self.file_path, 'r', encoding='utf-8') as f:
                    self.items = json.load(f)
                if not isinstance(self.items, list):
                    spider.logger.warning(f"Values.json does not contain a list. Initializing with an empty list.")
                    self.items = []
            except json.JSONDecodeError:
                spider.logger.error(f"Error decoding JSON from {self.file_path}. Initializing with an empty list.")
                self.items = []
            except Exception as e:
                spider.logger.error(f"Unexpected error reading {self.file_path}: {e}. Initializing with an empty list.")
                self.items = []
        else:
            if not os.path.exists(self.file_path):
                spider.logger.info(f"{self.file_path} does not exist. Will create it upon closing.")
            elif os.path.getsize(self.file_path) == 0:
                spider.logger.info(f"{self.file_path} is empty. Initializing with an empty list.")
            self.items = []

    def process_item(self, item, spider):
        self.items.append(dict(item))
        return item

    def close_spider(self, spider):
        try:
            with open(self.file_path, 'w', encoding='utf-8') as f:
                json.dump(self.items, f, indent=4, ensure_ascii=False)
            spider.logger.info(f"Successfully wrote {len(self.items)} items to {self.file_path}")
        except Exception as e:
            spider.logger.error(f"Error writing to {self.file_path}: {e}")

# It's good practice to keep the default pipeline if it's there,
# unless explicitly told to remove it. The problem description does not
# mention removing other pipelines, just making sure no other pipeline
# writes to Values.json in a conflicting way.
# For now, I assume GoldmanduPipeline is not conflicting.
class GoldmanduPipeline:
    def process_item(self, item, spider):
        return item
