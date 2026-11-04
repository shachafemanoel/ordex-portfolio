FROM wordpress:7.1.4-php8.3-apache
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates default-mysql-client postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://github.com/wp-cli/wp-cli/releases/download/v2.12.0/wp-cli-2.12.0.phar -o /usr/local/bin/wp \
    && chmod +x /usr/local/bin/wp
COPY infra/wordpress/retzef-demo.php /opt/retzef/retzef-demo.php
COPY infra/wordpress/seed-demo.php /opt/retzef/seed-demo.php
COPY scripts/demo/snapshot.sh /opt/retzef/snapshot.sh
COPY infra/wordpress/entrypoint.sh /opt/retzef/entrypoint.sh
RUN chmod 755 /opt/retzef/snapshot.sh /opt/retzef/entrypoint.sh
ENTRYPOINT ["/opt/retzef/entrypoint.sh"]
CMD ["apache2-foreground"]
# Official entrypoint initializes the filesystem only. Core/plugin/data setup is an explicit
# operator step after budget approval; it never runs from CMD or entrypoint.
